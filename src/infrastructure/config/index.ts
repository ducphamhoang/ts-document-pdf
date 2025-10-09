import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

interface FileConfig {
  maxFileSizeMB: number;
  retentionHours: number;
}

interface ConversionConfig {
  timeoutMs: number;
  maxConcurrentConversions: number;
}

interface ServerConfig {
  port: number;
  baseUrl: string;
}

interface AppConfig {
  server: ServerConfig;
  files: FileConfig;
  conversion: ConversionConfig;
  logLevel: string;
}

// Default configuration values
const defaultConfig: AppConfig = {
  server: {
    port: 3000,
    baseUrl: 'http://localhost:3000',
  },
  files: {
    maxFileSizeMB: 25,
    retentionHours: 24,
  },
  conversion: {
    timeoutMs: 30000, // 30 seconds
    maxConcurrentConversions: 5,
  },
  logLevel: 'info',
};

// Load configuration from environment variables
const config: AppConfig = {
  server: {
    port: parseInt(process.env.PORT || '', 10) || defaultConfig.server.port,
    baseUrl: process.env.BASE_URL || defaultConfig.server.baseUrl,
  },
  files: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB || '', 10) || defaultConfig.files.maxFileSizeMB,
    retentionHours: parseInt(process.env.FILE_RETENTION_HOURS || '', 10) || defaultConfig.files.retentionHours,
  },
  conversion: {
    timeoutMs: parseInt(process.env.CONVERSION_TIMEOUT_MS || '', 10) || defaultConfig.conversion.timeoutMs,
    maxConcurrentConversions: parseInt(process.env.MAX_CONCURRENT_CONVERSIONS || '', 10) || defaultConfig.conversion.maxConcurrentConversions,
  },
  logLevel: process.env.LOG_LEVEL || defaultConfig.logLevel,
};

export default config;
export { AppConfig, FileConfig, ConversionConfig, ServerConfig };