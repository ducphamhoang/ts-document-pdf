import { Position } from './translation-item.entity';

/**
 * Represents the result of translating a single item
 * Structure is identical to TranslationItem but contains translated text
 */
export class TranslatedItem {
  readonly id: string; // Preserved from original TranslationItem
  readonly text: string; // Translated text content
  readonly position: Position; // Preserved from original TranslationItem

  constructor(id: string, text: string, position: Position) {
    this.id = id;
    this.text = text;
    this.position = position;
  }

  /**
   * Create a TranslatedItem from plain object
   */
  static from(data: { id: string; text: string; position: Position }): TranslatedItem {
    return new TranslatedItem(data.id, data.text, data.position);
  }

  /**
   * Create a TranslatedItem from a TranslationItem with translated text
   */
  static fromTranslation(
    originalItem: { id: string; position: Position },
    translatedText: string
  ): TranslatedItem {
    return new TranslatedItem(originalItem.id, translatedText, originalItem.position);
  }
}
