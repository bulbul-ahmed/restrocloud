import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class OnlineCartModifierDto {
  @ApiProperty()
  @IsUUID()
  modifierId: string;
}
