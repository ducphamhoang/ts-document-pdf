import { v4 as uuidv4 } from 'uuid';
import { ConversionStatus } from '../../domain/entities/conversion-job.entity';
import logger from '../logger/winston.logger';
import config from '../config';

interface QueuedTask<T = any> {
  id: string;
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  queuedAt: Date;
}

export interface IConversionQueueService {
  execute<T>(task: () => Promise<T>): Promise<T>;
  getCurrentQueueLength(): number;
  getActiveConversionCount(): number;
  getStatus(): { queueLength: number; activeConversions: number; maxConcurrent: number };
}

export class ConversionQueueService implements IConversionQueueService {
  private queue: QueuedTask[] = [];
  private activeCount = 0;
  private maxConcurrentConversions: number;

  constructor() {
    this.maxConcurrentConversions = config.conversion.maxConcurrentConversions || 5;
    // Start processing queue automatically
    this.processQueue();

    // Log queue metrics periodically for monitoring
    setInterval(() => {
      if (this.queue.length > 0 || this.activeCount > 0) {
        // Only log if there's activity
        logger.info('Queue metrics', {
          queueLength: this.queue.length,
          activeConversions: this.activeCount,
          maxConcurrent: this.maxConcurrentConversions,
          utilization: `${Math.round((this.activeCount / this.maxConcurrentConversions) * 100)}%`,
        });
      }
    }, 30000); // Log every 30 seconds if there's activity
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount < this.maxConcurrentConversions) {
      // If we have capacity, execute immediately
      this.activeCount++;
      logger.debug('Executing conversion task immediately', {
        activeConversions: this.activeCount,
        maxConcurrent: this.maxConcurrentConversions,
      });

      try {
        const result = await task();
        this.activeCount--;
        // Process next item in queue if available
        setImmediate(() => this.processQueue());
        return result;
      } catch (error) {
        this.activeCount--;
        // Process next item in queue if available
        setImmediate(() => this.processQueue());
        throw error;
      }
    } else {
      // Otherwise, add to queue
      return new Promise<T>((resolve, reject) => {
        const queuedTask: QueuedTask<T> = {
          id: uuidv4(),
          task,
          resolve: resolve as (value: any) => void,
          reject,
          queuedAt: new Date(),
        };
        this.queue.push(queuedTask as QueuedTask);

        logger.info('Conversion task queued', {
          taskId: queuedTask.id,
          queueLength: this.queue.length,
          activeConversions: this.activeCount,
          maxConcurrent: this.maxConcurrentConversions,
          waitTimeMs: Date.now() - queuedTask.queuedAt.getTime(),
        });
      });
    }
  }

  private async processQueue(): Promise<void> {
    // Process items in the queue if we have capacity
    while (this.queue.length > 0 && this.activeCount < this.maxConcurrentConversions) {
      const nextTask = this.queue.shift();
      if (!nextTask) break;

      this.activeCount++;

      logger.info('Processing queued task', {
        taskId: nextTask.id,
        queueLength: this.queue.length,
        activeConversions: this.activeCount,
        maxConcurrent: this.maxConcurrentConversions,
      });

      // Execute the queued task
      const startTime = Date.now();
      nextTask
        .task()
        .then(result => {
          const duration = Date.now() - startTime;
          this.activeCount--;
          nextTask.resolve(result);

          logger.info('Queued task completed', {
            taskId: nextTask.id,
            durationMs: duration,
            activeConversions: this.activeCount,
            queueLength: this.queue.length,
          });

          // Process next item in queue if available
          setImmediate(() => this.processQueue());
        })
        .catch(error => {
          const duration = Date.now() - startTime;
          this.activeCount--;
          nextTask.reject(error);

          logger.error('Queued task failed', {
            taskId: nextTask.id,
            durationMs: duration,
            activeConversions: this.activeCount,
            queueLength: this.queue.length,
            error: error instanceof Error ? error.message : 'Unknown error',
          });

          // Process next item in queue if available
          setImmediate(() => this.processQueue());
        });
    }
  }

  getCurrentQueueLength(): number {
    return this.queue.length;
  }

  getActiveConversionCount(): number {
    return this.activeCount;
  }

  getStatus(): { queueLength: number; activeConversions: number; maxConcurrent: number } {
    return {
      queueLength: this.getCurrentQueueLength(),
      activeConversions: this.getActiveConversionCount(),
      maxConcurrent: this.maxConcurrentConversions,
    };
  }
}
