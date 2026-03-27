import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class ListTablesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by floor section UUID' })
  @IsOptional()
  @IsUUID()
  floorSectionId?: string;

  @ApiPropertyOptional({ enum: TableStatus, description: 'Filter by table status' })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}
