import { IsString, IsNotEmpty, IsArray, ArrayMinSize, ValidateNested, IsNumber, Min, Matches } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Position DTO for text item location metadata
 */
export class PositionDto {
  @IsNumber()
  @Min(1, { message: 'Page number must be at least 1' })
  page!: number;

  @IsNumber()
  @Min(0, { message: 'X coordinate must be non-negative' })
  x!: number;

  @IsNumber()
  @Min(0, { message: 'Y coordinate must be non-negative' })
  y!: number;
}

/**
 * Individual text item DTO for translation request
 */
export class RequestItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Item ID cannot be empty' })
  id!: string;

  @IsString()
  @IsNotEmpty({ message: 'Text cannot be empty' })
  text!: string;

  @ValidateNested()
  @Type(() => PositionDto)
  position!: PositionDto;
}

/**
 * Translation request DTO
 * Validates the entire POST /api/v1/translate request body
 */
export class TranslateRequestDto {
  @IsString()
  @IsNotEmpty({ message: 'Source language is required' })
  @Matches(/^[a-z]{2}$/, { message: 'Source language must be a valid ISO 639-1 code (e.g., "en")' })
  sourceLanguage!: string;

  @IsString()
  @IsNotEmpty({ message: 'Target language is required' })
  @Matches(/^[a-z]{2}$/, { message: 'Target language must be a valid ISO 639-1 code (e.g., "fr")' })
  targetLanguage!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Items array must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => RequestItemDto)
  items!: RequestItemDto[];
}
