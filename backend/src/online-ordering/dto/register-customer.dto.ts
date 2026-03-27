import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterCustomerDto {
  @ApiProperty({ example: 'Arif' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiPropertyOptional({ example: 'Hossain' })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ example: 'arif@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+8801711000000' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'P@ssword123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}
