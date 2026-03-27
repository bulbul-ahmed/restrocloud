import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ToggleAvailabilityDto {
  @ApiProperty({ example: false })
  @IsBoolean()
  isAvailable: boolean;
}
