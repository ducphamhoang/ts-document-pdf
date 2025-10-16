import { TranslationItem } from './translation-item.entity';

/**
 * Represents a complete translation request with multiple items
 * Includes metadata about the job such as languages, timestamps, and token count
 */
export class TranslationJob {
  readonly requestId: string; // UUID v4 format
  readonly sourceLanguage: string; // ISO 639-1 code (e.g., "en")
  readonly targetLanguage: string; // ISO 639-1 code (e.g., "fr")
  readonly items: readonly TranslationItem[]; // Array of text items (1-100 items)
  readonly createdAt: Date;
  readonly totalTokens?: number; // Optional: calculated token count

  constructor(
    requestId: string,
    sourceLanguage: string,
    targetLanguage: string,
    items: TranslationItem[],
    createdAt: Date,
    totalTokens?: number
  ) {
    this.requestId = requestId;
    this.sourceLanguage = sourceLanguage.toLowerCase();
    this.targetLanguage = targetLanguage.toLowerCase();
    this.items = Object.freeze([...items]); // Immutable array
    this.createdAt = createdAt;
    this.totalTokens = totalTokens;
  }

  /**
   * Create a TranslationJob from plain object
   */
  static from(data: {
    requestId: string;
    sourceLanguage: string;
    targetLanguage: string;
    items: TranslationItem[];
    createdAt?: Date;
    totalTokens?: number;
  }): TranslationJob {
    return new TranslationJob(
      data.requestId,
      data.sourceLanguage,
      data.targetLanguage,
      data.items,
      data.createdAt || new Date(),
      data.totalTokens
    );
  }
}
