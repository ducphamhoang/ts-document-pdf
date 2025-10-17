import { ConversionQueueService } from '../../src/infrastructure/services/conversion-queue.service';
import config from '../../src/infrastructure/config';

describe('ConversionQueueService Comprehensive Tests', () => {
  let queueService: ConversionQueueService;

  beforeEach(() => {
    // Create a new queue service instance for each test to avoid side effects
    queueService = new ConversionQueueService();
  });

  afterEach(() => {
    // Clean up the queue by processing any remaining items
    queueService = null as any; // Allow garbage collection
  });

  describe('Basic functionality', () => {
    it('should execute tasks immediately when under capacity', async () => {
      const task = jest.fn().mockResolvedValue('task result');

      const result = await queueService.execute(task);

      expect(result).toBe('task result');
      expect(task).toHaveBeenCalled();
      expect(queueService.getCurrentQueueLength()).toBe(0);
      expect(queueService.getActiveConversionCount()).toBe(0);
    });

    it('should return the correct result from executed task', async () => {
      const expectedResult = { id: 'test', data: 'result' };
      const task = jest.fn().mockResolvedValue(expectedResult);

      const result = await queueService.execute(task);

      expect(result).toEqual(expectedResult);
    });

    it('should execute tasks that return void', async () => {
      const task = jest.fn().mockResolvedValue(undefined);

      const result = await queueService.execute(task);

      expect(result).toBeUndefined();
      expect(task).toHaveBeenCalled();
    });
  });

  describe('Concurrency limits', () => {
    it('should respect max concurrent conversion limit', async () => {
      // Mock config to set max concurrent conversions to 2
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 2;

      try {
        const queue = new ConversionQueueService();

        // Start 3 tasks that will wait for resolution
        const resolveFunctions: Array<() => void> = [];
        const tasks = Array(3)
          .fill(0)
          .map(() => {
            return jest.fn().mockImplementation(() => {
              return new Promise<void>(resolve => {
                resolveFunctions.push(resolve);
              });
            });
          });

        // Execute all 3 tasks
        const promises = tasks.map(task => queue.execute(task));

        // At this point, 2 tasks should be active and 1 should be queued
        expect(queue.getActiveConversionCount()).toBe(2);
        expect(queue.getCurrentQueueLength()).toBe(1);

        // Resolve the first task
        resolveFunctions[0]();
        await Promise.resolve(); // Allow the next task to start

        // Now 2 tasks should be active again (the completed one is replaced by queued one)
        expect(queue.getActiveConversionCount()).toBe(2);
        expect(queue.getCurrentQueueLength()).toBe(0);

        // Resolve remaining tasks
        resolveFunctions[1]();
        resolveFunctions[2]();
        await Promise.all(promises);

        // All tasks should have been executed
        expect(tasks[0]).toHaveBeenCalled();
        expect(tasks[1]).toHaveBeenCalled();
        expect(tasks[2]).toHaveBeenCalled();
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should process queued tasks when active tasks complete', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        const firstTaskResolved = new Promise<void>(resolve => {
          setTimeout(resolve, 0);
        });
        const firstTask = jest.fn().mockImplementation(() => firstTaskResolved);

        const secondTaskPromise = new Promise<void>(resolve => {
          setTimeout(resolve, 10); // Slightly longer for determinism
        });
        const secondTask = jest.fn().mockImplementation(() => secondTaskPromise);

        // Execute first task
        const firstPromise = queue.execute(firstTask);

        // Execute second task (should be queued)
        const secondPromise = queue.execute(secondTask);

        // At this point, 1 task should be active and 1 should be queued
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(1);

        // Resolve the first task to allow the second to execute
        (firstTaskResolved as any).resolve = () => {};
        (firstTaskResolved as any).resolve();
        await firstPromise;

        // Second task should now be executing
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(0);

        // Resolve second task
        (secondTaskPromise as any).resolve = () => {};
        (secondTaskPromise as any).resolve();
        await secondPromise;

        expect(firstTask).toHaveBeenCalled();
        expect(secondTask).toHaveBeenCalled();
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should handle tasks completing in different orders', async () => {
      // Mock config to set max concurrent conversions to 2
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 2;

      try {
        const queue = new ConversionQueueService();

        // Create tasks with different execution times
        const slowTaskPromise = new Promise<void>(resolve => setTimeout(resolve, 100));
        const slowTask = jest.fn().mockImplementation(() => slowTaskPromise);

        const fastTaskPromise = new Promise<void>(resolve => setTimeout(resolve, 10));
        const fastTask = jest.fn().mockImplementation(() => fastTaskPromise);

        const thirdTaskPromise = new Promise<void>(resolve => setTimeout(resolve, 50));
        const thirdTask = jest.fn().mockImplementation(() => thirdTaskPromise);

        // Execute first two tasks (which will be active)
        const slowPromise = queue.execute(slowTask);
        const fastPromise = queue.execute(fastTask);

        // Execute third task (should be queued)
        const thirdPromise = queue.execute(thirdTask);

        // Initially: 2 active, 1 queued
        expect(queue.getActiveConversionCount()).toBe(2);
        expect(queue.getCurrentQueueLength()).toBe(1);

        // Wait for fast task to complete (first)
        await fastPromise;

        // Even after fast task completes, there should still be 2 active (slow + third task)
        expect(queue.getActiveConversionCount()).toBe(2);
        expect(queue.getCurrentQueueLength()).toBe(0);

        // Complete remaining tasks
        (slowTaskPromise as any).resolve();
        (thirdTaskPromise as any).resolve();

        await Promise.all([slowPromise, thirdPromise]);

        expect(slowTask).toHaveBeenCalled();
        expect(fastTask).toHaveBeenCalled();
        expect(thirdTask).toHaveBeenCalled();
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });
  });

  describe('Queue behavior', () => {
    it('should queue tasks when at maximum capacity', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        // Create a promise that won't resolve immediately
        let firstTaskResolver: () => void;
        const firstTaskPromise = new Promise<void>(resolve => {
          firstTaskResolver = resolve;
        });
        const firstTask = jest.fn().mockImplementation(() => firstTaskPromise);

        // Create a second task
        const secondTask = jest.fn().mockResolvedValue('second result');

        // Execute first task
        const firstPromise = queue.execute(firstTask);

        // Execute second task (should be queued)
        const secondPromise = queue.execute(secondTask);

        // Verify queue state
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(1);

        // Resolve first task to allow second to execute
        firstTaskResolver!();
        const secondResult = await secondPromise;

        // Verify second task executed and completed
        expect(secondResult).toBe('second result');
        expect(secondTask).toHaveBeenCalled();

        await firstPromise; // Wait for first to complete
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should maintain queue order (FIFO)', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        const executionOrder: number[] = [];

        // Create tasks that record their execution order
        const task1Promise = new Promise<void>(resolve =>
          setTimeout(() => {
            executionOrder.push(1);
            resolve();
          }, 10)
        );
        const task1 = jest.fn().mockImplementation(() => task1Promise);

        const task2Promise = new Promise<void>(resolve =>
          setTimeout(() => {
            executionOrder.push(2);
            resolve();
          }, 10)
        );
        const task2 = jest.fn().mockImplementation(() => task2Promise);

        const task3Promise = new Promise<void>(resolve =>
          setTimeout(() => {
            executionOrder.push(3);
            resolve();
          }, 10)
        );
        const task3 = jest.fn().mockImplementation(() => task3Promise);

        // Execute tasks in sequence
        const promise1 = queue.execute(task1);
        const promise2 = queue.execute(task2); // This should be queued
        const promise3 = queue.execute(task3); // This should be queued too

        // First task should be active, others should be queued
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(2);

        // Wait for all tasks to complete
        await Promise.all([promise1, promise2, promise3]);

        // Verify execution order is FIFO (1, then 2, then 3)
        expect(executionOrder).toEqual([1, 2, 3]);
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should process all queued tasks when capacity becomes available', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        // Queue up multiple tasks that resolve in sequence
        const tasks = Array(5)
          .fill(0)
          .map((_, i) => jest.fn().mockResolvedValue(`result-${i}`));

        const promises = tasks.map(task => queue.execute(task));

        // All but the first should be queued
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(4);

        // Wait for all tasks to complete
        const results = await Promise.all(promises);

        // All tasks should have executed
        for (let i = 0; i < tasks.length; i++) {
          expect(tasks[i]).toHaveBeenCalled();
          expect(results[i]).toBe(`result-${i}`);
        }

        // Final state should be empty
        expect(queue.getActiveConversionCount()).toBe(0);
        expect(queue.getCurrentQueueLength()).toBe(0);
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });
  });

  describe('Error handling', () => {
    it('should propagate errors from tasks executed immediately', async () => {
      const errorTask = jest.fn().mockRejectedValue(new Error('Task failed'));

      await expect(queueService.execute(errorTask)).rejects.toThrow('Task failed');

      expect(errorTask).toHaveBeenCalled();
      expect(queueService.getActiveConversionCount()).toBe(0);
    });

    it('should propagate errors from queued tasks', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        // Execute a long-running first task
        const firstTaskPromise = new Promise<void>(() => {});
        const firstTask = jest.fn().mockImplementation(() => firstTaskPromise);
        queue.execute(firstTask);

        // Queue a task that will throw an error
        const errorTask = jest.fn().mockRejectedValue(new Error('Queued task failed'));
        const queuedPromise = queue.execute(errorTask);

        // Verify queue state
        expect(queue.getActiveConversionCount()).toBe(1);
        expect(queue.getCurrentQueueLength()).toBe(1);

        // Wait for the error to be propagated
        await expect(queuedPromise).rejects.toThrow('Queued task failed');

        expect(errorTask).toHaveBeenCalled();
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should continue processing other tasks after one fails', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        const successTask = jest.fn().mockResolvedValue('success');
        const errorTask = jest.fn().mockRejectedValue(new Error('Failed'));
        const anotherSuccessTask = jest.fn().mockResolvedValue('another success');

        // Execute tasks in sequence
        const successPromise = queue.execute(successTask);
        const errorPromise = queue.execute(errorTask); // This will be queued
        const anotherPromise = queue.execute(anotherSuccessTask); // This will also be queued

        // Wait for all promises (the error should be caught)
        const results = await Promise.allSettled([successPromise, errorPromise, anotherPromise]);

        // Check that the error task failed
        expect(results[1].status).toBe('rejected');
        expect((results[1] as PromiseRejectedResult).reason.message).toBe('Failed');

        // Check that other tasks succeeded
        expect(successTask).toHaveBeenCalled();
        expect(anotherSuccessTask).toHaveBeenCalled();
        expect(results[0].status).toBe('fulfilled');
        expect(results[2].status).toBe('fulfilled');
        expect((results[0] as PromiseFulfilledResult<any>).value).toBe('success');
        expect((results[2] as PromiseFulfilledResult<any>).value).toBe('another success');
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });
  });

  describe('Queue status reporting', () => {
    it('should return correct queue length', async () => {
      // Mock config to set max concurrent conversions to 1
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 1;

      try {
        const queue = new ConversionQueueService();

        // Execute a long-running first task
        const firstTaskPromise = new Promise<void>(() => {});
        const firstTask = jest.fn().mockImplementation(() => firstTaskPromise);
        queue.execute(firstTask);

        // Queue multiple tasks
        const queuedPromises = [];
        for (let i = 0; i < 3; i++) {
          const queuedTask = jest.fn().mockResolvedValue(`result-${i}`);
          queuedPromises.push(queue.execute(queuedTask));
        }

        // Verify queue length
        expect(queue.getCurrentQueueLength()).toBe(3);
        expect(queue.getStatus().queueLength).toBe(3);

        // Clean up
        await Promise.allSettled(queuedPromises);
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should return correct active conversion count', async () => {
      // With one active task
      const taskPromise = new Promise<void>(() => {});
      const task = jest.fn().mockImplementation(() => taskPromise);
      queueService.execute(task);

      expect(queueService.getActiveConversionCount()).toBe(1);
      expect(queueService.getStatus().activeConversions).toBe(1);
    });

    it('should return complete status information', async () => {
      const status = queueService.getStatus();

      expect(status).toHaveProperty('queueLength');
      expect(status).toHaveProperty('activeConversions');
      expect(status).toHaveProperty('maxConcurrent');
      expect(typeof status.queueLength).toBe('number');
      expect(typeof status.activeConversions).toBe('number');
      expect(typeof status.maxConcurrent).toBe('number');
    });
  });

  describe('Edge cases', () => {
    it('should handle immediate synchronous tasks', async () => {
      const syncTask = jest.fn().mockResolvedValue('sync result');

      const result = await queueService.execute(syncTask);

      expect(result).toBe('sync result');
      expect(syncTask).toHaveBeenCalled();
    });

    it('should handle tasks that take varying amounts of time', async () => {
      // Mock config to set max concurrent conversions to 2
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 2;

      try {
        const queue = new ConversionQueueService();

        // Fast task
        const fastTask = jest.fn().mockResolvedValue('fast');

        // Slow task
        const slowTaskPromise = new Promise<void>(resolve => setTimeout(resolve, 50));
        const slowTask = jest.fn().mockImplementation(() => slowTaskPromise);

        // Another fast task that will be queued
        const queuedFastTask = jest.fn().mockResolvedValue('queued fast');

        // Execute tasks
        const fastResult = queue.execute(fastTask);
        const slowPromise = queue.execute(slowTask); // This will be active
        const queuedResult = queue.execute(queuedFastTask); // This will be queued

        // Verify initial state
        expect(queue.getActiveConversionCount()).toBe(2); // fast + slow
        expect(queue.getCurrentQueueLength()).toBe(1); // queuedFastTask

        // Wait for slow task to complete, allowing queued task to run
        (slowTaskPromise as any).resolve();
        await slowPromise;

        // Get results
        const [fast, queued] = await Promise.all([fastResult, queuedResult]);

        expect(fast).toBe('fast');
        expect(queued).toBe('queued fast');
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });

    it('should handle empty queue gracefully', async () => {
      expect(queueService.getCurrentQueueLength()).toBe(0);
      expect(queueService.getActiveConversionCount()).toBe(0);

      const status = queueService.getStatus();
      expect(status.queueLength).toBe(0);
      expect(status.activeConversions).toBe(0);
    });

    it('should handle high concurrency scenarios', async () => {
      // Mock config to set max concurrent conversions to 3
      const originalMaxConcurrent = (config as any).conversion.maxConcurrentConversions;
      (config as any).conversion.maxConcurrentConversions = 3;

      try {
        const queue = new ConversionQueueService();

        const tasks = Array(10)
          .fill(0)
          .map((_, i) => jest.fn().mockResolvedValue(`result-${i}`));

        const promises = tasks.map(task => queue.execute(task));

        // At most 3 should be active initially, rest should be queued
        expect(queue.getActiveConversionCount()).toBeLessThanOrEqual(3);
        expect(queue.getCurrentQueueLength()).toBeGreaterThanOrEqual(7);

        // Wait for all to complete
        const results = await Promise.all(promises);

        // Verify all tasks ran and returned correct results
        for (let i = 0; i < tasks.length; i++) {
          expect(tasks[i]).toHaveBeenCalled();
          expect(results[i]).toBe(`result-${i}`);
        }
      } finally {
        // Restore original value
        (config as any).conversion.maxConcurrentConversions = originalMaxConcurrent;
      }
    });
  });

  describe('Configuration', () => {
    it('should use the configured max concurrent conversions limit', () => {
      // The default limit is set in config
      const expectedLimit = config.conversion.maxConcurrentConversions;
      const status = queueService.getStatus();

      expect(status.maxConcurrent).toBe(expectedLimit);
    });
  });
});
