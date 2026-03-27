import { IsBoolean, IsNumber, IsOptional, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateAddressDto {
  @ApiPropertyOptional({ example: 'Home', description: 'Label for the address' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiProperty({ example: 'House 12, Road 5, Block A' })
  @IsString()
  @MinLength(3)
  line1: string;

  @ApiPropertyOptional({ example: 'Mirpur DOHS' })
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiProperty({ example: 'Dhaka' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Mirpur' })
  @IsOptional()
  @IsString()
  area?: string;

  @ApiPropertyOptional({ example: '1216' })
  @IsOptional()
  @IsString()
  postalCode?: string;

  @ApiPropertyOptional({ default: 'BD' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ example: 23.8103 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lat?: number;

  @ApiPropertyOptional({ example: 90.4125 })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lng?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
