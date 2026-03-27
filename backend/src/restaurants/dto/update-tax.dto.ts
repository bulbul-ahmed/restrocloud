import { IsNumber, IsBoolean, IsOptional, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTaxDto {
  @ApiPropertyOptional({ example: 15, description: 'Tax rate as percentage (0–100)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxRate?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'true = prices already include tax; false = tax added on top',
  })
  @IsOptional()
  @IsBoolean()
  taxInclusive?: boolean;
}
