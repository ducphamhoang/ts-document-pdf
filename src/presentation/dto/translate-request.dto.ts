import {
  IsString,
  IsNotEmpty,
  IsArray,
  ArrayMinSize,
  ValidateNested,
  IsNumber,
  Min,
  Matches,
  MaxLength,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Position DTO for text item location metadata
 */
export class PositionDto {
  @IsNumber()
  @Min(1, { message: 'Page number must be at least 1' })
  @Max(10000, { message: 'Page number must not exceed 10000' })
  page!: number;

  @IsNumber()
  @Min(0, { message: 'X coordinate must be non-negative' })
  @Max(100000, { message: 'X coordinate must not exceed 100000' })
  x!: number;

  @IsNumber()
  @Min(0, { message: 'Y coordinate must be non-negative' })
  @Max(100000, { message: 'Y coordinate must not exceed 100000' })
  y!: number;
}

/**
 * Individual text item DTO for translation request
 */
export class RequestItemDto {
  @IsString()
  @IsNotEmpty({ message: 'Item ID cannot be empty' })
  @MaxLength(500, { message: 'Item ID must not exceed 500 characters' })
  id!: string;

  @IsString()
  @IsNotEmpty({ message: 'Text cannot be empty' })
  @MaxLength(50000, { message: 'Text must not exceed 50000 characters per item' })
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
