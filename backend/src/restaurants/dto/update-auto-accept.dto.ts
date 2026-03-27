import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateAutoAcceptDto {
  @ApiPropertyOptional({
    example: true,
    description: 'Auto-accept orders placed through POS',
  })
  @IsOptional()
  @IsBoolean()
  pos?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Auto-accept orders placed via QR table scan',
  })
  @IsOptional()
  @IsBoolean()
  qr?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Auto-accept orders placed via online ordering website',
  })
  @IsOptional()
  @IsBoolean()
  online?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Auto-accept aggregator orders (Foodpanda, Pathao, etc.)',
  })
  @IsOptional()
  @IsBoolean()
  aggregator?: boolean;
}
