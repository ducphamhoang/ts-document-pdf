export interface IFileConverter {
  convert(inputPath: string, outputDir: string): Promise<string>;
}