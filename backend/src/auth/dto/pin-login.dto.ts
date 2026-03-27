import { IsString, IsNotEmpty, IsUUID, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinLoginDto {
  @ApiProperty({ example: 'e5b2b950-3616-4cc2-aa67-9aace63b05eb' })
  @IsUUID()
  restaurantId: string;

  @ApiProperty({ example: '1234', description: '4–6 digit POS PIN' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,6}$/, { message: 'PIN must be 4–6 digits' })
  pin: string;
}
