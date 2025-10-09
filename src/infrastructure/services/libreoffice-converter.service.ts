import { execFile } from 'child_process';
import { promisify } from 'util';
import { IFileConverter } from '../../application/interfaces/file-converter.interface';
import { ConversionFailedError, ConversionTimeoutError } from '../../domain/errors';
import config from '../config';
import logger from '../logger/winston.logger';

const execFilePromise = promisify(execFile);

export class LibreOfficeConverter implements IFileConverter {
  async convert(inputPath: string, outputDir: string): Promise<string> {
    const args = [
      '--headless',
      '--convert-to', 'pdf',
      '--outdir', outputDir,
      inputPath
    ];

    try {
      // Execute LibreOffice conversion with timeout
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

      logger.info(`Conversion completed for ${inputPath}`, { stdout, stderr });

      // Find the converted PDF file in the output directory
      // LibreOffice typically converts the file to the same name with .pdf extension
      const inputFileName = inputPath.split('/').pop()?.split('.')[0] || '';
      const convertedFilePath = `${outputDir}/${inputFileName}.pdf`;

      return convertedFilePath;
    } catch (error) {
      if (error instanceof ConversionTimeoutError) {
        throw error;
      }

      logger.error(`Conversion failed for ${inputPath}`, { error });

      // Check if it's a timeout error from execFile
      if (error && typeof error === 'object' && 'killed' in error && (error as any).killed) {
        throw new ConversionTimeoutError(`Conversion timed out after ${config.conversion.timeoutMs}ms`);
      }

      // Check if it's a generic error with message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error during conversion';
      throw new ConversionFailedError(`Conversion failed: ${errorMessage}`);
    }
  }
}