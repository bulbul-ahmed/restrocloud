import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsOptional, IsInt, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTableDto {
  @ApiProperty({ example: 'uuid-of-floor-section' })
  @IsUUID()
  floorSectionId: string;

  @ApiProperty({ example: 'T1' })
  @IsString()
  tableNumber: string;

  @ApiPropertyOptional({ example: 4, default: 2 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  capacity?: number;

  @ApiPropertyOptional({ example: 10.5, description: 'Floor plan X position' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posX?: number;

  @ApiPropertyOptional({ example: 20.0, description: 'Floor plan Y position' })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  posY?: number;
}
