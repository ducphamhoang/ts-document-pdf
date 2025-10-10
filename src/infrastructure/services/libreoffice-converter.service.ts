import { execFile } from 'child_process';
import { promisify } from 'util';
import { IFileConverter } from '../../application/interfaces/file-converter.interface';
import { ConversionFailedError, ConversionTimeoutError } from '../../domain/errors';
import config from '../config';
import logger from '../logger/winston.logger';

const execFilePromise = promisify(execFile);

interface ConversionTask {
  args: string[];
  inputPath: string;
  outputDir: string;
  resolve: (value: string) => void;
  reject: (reason: any) => void;
}

export class LibreOfficeConverter implements IFileConverter {
  private activeConversions = 0;
  private maxConcurrentConversions: number;
  private taskQueue: ConversionTask[] = [];

  constructor() {
    this.maxConcurrentConversions = config.conversion.maxConcurrentConversions || 5;
  }

  async convert(inputPath: string, outputDir: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const task: ConversionTask = {
        args: [
          '--headless',
          '--convert-to', 'pdf',
          '--outdir', outputDir,
          inputPath
        ],
        inputPath,
        outputDir,
        resolve,
        reject
      };

      // If we have capacity, run immediately; otherwise queue
      if (this.activeConversions < this.maxConcurrentConversions) {
        this.runConversion(task);
      } else {
        this.taskQueue.push(task);
        logger.info(`Conversion task queued due to concurrency limits`, {
          inputPath,
          queueLength: this.taskQueue.length,
          activeConversions: this.activeConversions,
          maxConcurrent: this.maxConcurrentConversions
        });
      }
    });
  }

  private async runConversion(task: ConversionTask): Promise<void> {
    const { args, inputPath, outputDir } = task;
    
    this.activeConversions++;
    
    logger.info(`Starting LibreOffice conversion process`, { 
      inputPath, 
      outputDir,
      timeoutMs: config.conversion.timeoutMs,
      activeConversions: this.activeConversions,
      maxConcurrent: this.maxConcurrentConversions
    });

    try {
      // Execute LibreOffice conversion with timeout using both execFile timeout and Promise.race
      const execStartTime = Date.now();
      const { stdout, stderr } = await Promise.race([
        execFilePromise('libreoffice', args, { 
          timeout: config.conversion.timeoutMs 
        }),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new ConversionTimeoutError(`Conversion timed out after ${config.conversion.timeoutMs}ms`));
          }, config.conversion.timeoutMs);
        })
      ]);

      const execDuration = Date.now() - execStartTime;
      
      // Check stderr for any conversion warnings/errors from LibreOffice
      if (stderr && stderr.trim() !== '') {
        logger.warn(`LibreOffice reported warnings during conversion of ${inputPath}`, { stderr });
      }

      logger.info(`Conversion completed for ${inputPath}`, { 
        stdout, 
        stderr: stderr || 'none',
        durationMs: execDuration,
        activeConversions: this.activeConversions
      });

      // Find the converted PDF file in the output directory
      // LibreOffice typically converts the file to the same name with .pdf extension
      const inputFileName = inputPath.split('/').pop()?.split('.')[0] || '';
      const convertedFilePath = `${outputDir}/${inputFileName}.pdf`;

      task.resolve(convertedFilePath);
    } catch (error) {
      const execDuration = Date.now() - (Date.now() - 100); // Approximate duration if we can't calculate it properly
      
      if (error instanceof ConversionTimeoutError) {
        logger.error(`Conversion timed out for ${inputPath}`, {
          timeoutMs: config.conversion.timeoutMs,
          durationMs: execDuration,
          activeConversions: this.activeConversions
        });
        task.reject(error);
      } else {
        logger.error(`Conversion failed for ${inputPath}`, { 
          error: error instanceof Error ? error.message : 'Unknown error',
          durationMs: execDuration,
          activeConversions: this.activeConversions,
          ...(error instanceof Error ? { stack: error.stack } : {})
        });

        // Check if it's a timeout error from execFile (when the process is killed)
        if (error && typeof error === 'object' && 'killed' in error && (error as any).killed) {
          const timeoutError = new ConversionTimeoutError(
            `Conversion process for ${inputPath} was killed after ${config.conversion.timeoutMs}ms timeout`
          );
          logger.error(`Conversion process killed for ${inputPath}`, { 
            timeoutMs: config.conversion.timeoutMs,
            durationMs: execDuration,
            activeConversions: this.activeConversions
          });
          task.reject(timeoutError);
        } else if (error instanceof Error) {
          if (error.message.includes('ENOENT')) {
            // LibreOffice not found
            const notFoundError = new ConversionFailedError(
              `LibreOffice is not installed or not accessible in PATH. Please install LibreOffice to enable document conversion.`
            );
            logger.error(`LibreOffice not found for conversion`, {
              inputPath,
              durationMs: execDuration,
              activeConversions: this.activeConversions
            });
            task.reject(notFoundError);
          } else if (error.message.includes('EACCES')) {
            // Permission error
            const permissionError = new ConversionFailedError(
              `Permission denied when executing LibreOffice conversion. Please check permissions.`
            );
            logger.error(`Permission denied for conversion`, {
              inputPath,
              durationMs: execDuration,
              activeConversions: this.activeConversions
            });
            task.reject(permissionError);
          } else {
            // Include stderr in the error message if available
            const execError = new ConversionFailedError(
              `Conversion failed for ${inputPath}: ${error.message}. Please check that the input file is a valid office document.`
            );
            logger.error(`Conversion execution failed`, {
              inputPath,
              error: error.message,
              durationMs: execDuration,
              activeConversions: this.activeConversions
            });
            task.reject(execError);
          }
        } else {
          const unknownError = new ConversionFailedError(
            `Conversion failed for ${inputPath} due to an unknown error. Please verify the file format is supported.`
          );
          logger.error(`Unknown conversion error`, {
            inputPath,
            durationMs: execDuration,
            activeConversions: this.activeConversions
          });
          task.reject(unknownError);
        }
      }
    } finally {
      // Decrement active conversions counter
      this.activeConversions--;
      
      // Process as many tasks from the queue as possible within limits
      while (this.taskQueue.length > 0 && this.activeConversions < this.maxConcurrentConversions) {
        const nextTask = this.taskQueue.shift();
        if (nextTask) {
          logger.debug(`Processing next queued task`, {
            inputPath: nextTask.inputPath,
            queueLength: this.taskQueue.length,
            activeConversions: this.activeConversions + 1  // +1 because we're about to increment
          });
          this.runConversion(nextTask);
        }
      }
    }
  }
}