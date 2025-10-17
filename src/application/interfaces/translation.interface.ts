/**
 * Translation service interface
 * Abstracts the external translation API implementation
 * Allows for easy mocking and testing
 */
export interface ITranslationService {
  /**
   * Translate text from source language to target language
   * @param text The text to translate
   * @param sourceLanguage ISO 639-1 source language code (e.g., "en")
   * @param targetLanguage ISO 639-1 target language code (e.g., "fr")
   * @returns Translated text
   * @throws TranslationError if translation fails
   */
  translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string>;

  /**
   * Count tokens in the given text
   * Used for validating payload size before translation
   * @param text The text to count tokens for
   * @returns Number of tokens
   * @throws TranslationError if counting fails
   */
  countTokens(text: string): Promise<number>;
}
