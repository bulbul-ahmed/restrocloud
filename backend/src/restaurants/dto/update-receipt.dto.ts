import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateReceiptDto {
  @ApiPropertyOptional({ example: 'Spice Garden — Gulshan\n45 Gulshan Avenue, Dhaka' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  header?: string;

  @ApiPropertyOptional({ example: 'Thank you for dining with us!\nFollow us @spicegarden' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  footer?: string;

  @ApiPropertyOptional({ example: true, description: 'Show restaurant logo on receipt' })
  @IsOptional()
  @IsBoolean()
  showLogo?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Show itemized tax breakdown' })
  @IsOptional()
  @IsBoolean()
  showTaxBreakdown?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Show Wi-Fi password on receipt' })
  @IsOptional()
  @IsBoolean()
  showWifi?: boolean;

  @ApiPropertyOptional({ example: 'Password: spice123' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  wifiPassword?: string;
}
