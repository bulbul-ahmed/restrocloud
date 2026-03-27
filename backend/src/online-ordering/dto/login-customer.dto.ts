import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginCustomerDto {
  @ApiProperty({ example: 'arif@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'P@ssword123' })
  @IsString()
  @MinLength(8)
  password: string;
}
