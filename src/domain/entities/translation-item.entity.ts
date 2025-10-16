/**
 * Position metadata for a text item in a document
 */
export interface Position {
  readonly page: number; // Page number in source document (≥ 1)
  readonly x: number; // Horizontal coordinate (≥ 0)
  readonly y: number; // Vertical coordinate (≥ 0)
}

/**
 * Represents a single text item to be translated
 * Includes the text content and its positional metadata
 */
export class TranslationItem {
  readonly id: string;
  readonly text: string;
  readonly position: Position;

  constructor(id: string, text: string, position: Position) {
    this.id = id;
    this.text = text;
    this.position = position;
  }

  /**
   * Create a TranslationItem from plain object
   */
  static from(data: { id: string; text: string; position: Position }): TranslationItem {
    return new TranslationItem(data.id, data.text, data.position);
  }
}
