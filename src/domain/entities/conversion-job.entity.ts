export enum ConversionStatus {
  queued = 'queued',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
}

export interface ConversionJob {
  id: string;
  originalDocumentId: string;
  status: ConversionStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}
