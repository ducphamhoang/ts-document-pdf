import { Position } from '../../domain/entities/translation-item.entity';

/**
 * Translated item DTO for response
 * Contains the translated text with preserved ID and position
 */
export interface TranslatedItemDto {
  id: string;
  text: string;
  position: Position;
}

/**
 * Translation response DTO
 * Standard success response for POST /api/v1/translate
 */
export interface TranslateResponseDto {
  success: boolean;
  message: string;
  data: TranslatedItemDto[];
}

/**
 * Error response DTO
 * Standard error response format
 */
export interface ErrorResponseDto {
  success: boolean;
  message: string;
  error?: {
    code: string;
    details?: any;
  };
}
