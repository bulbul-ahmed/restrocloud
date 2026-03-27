import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';

export class ListItemsQueryDto {
  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ example: true, description: 'Filter by availability' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({ example: 'tikka', description: 'Name search (case-insensitive)' })
  @IsOptional()
  @IsString()
  search?: string;
}
