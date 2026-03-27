import { IsDateString, IsOptional } from 'class-validator';

export class InventoryQueryDto {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
