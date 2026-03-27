import { IsString, IsEmail, IsOptional, MinLength, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty({ example: 'Rahman' })
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty({ example: 'ahmed@myrestaurant.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'SecurePass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Spice Garden' })
  @IsString()
  @IsNotEmpty()
  restaurantName: string;

  @ApiPropertyOptional({ example: 'BD', description: 'ISO country code' })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  country?: string;
}
