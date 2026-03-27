import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateOrderModifierDto {
  @ApiProperty({ example: 'uuid-or-string-id-of-modifier' })
  @IsString()
  modifierId: string;
}
