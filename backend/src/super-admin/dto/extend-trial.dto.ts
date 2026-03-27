import { IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ExtendTrialDto {
  @ApiProperty({ example: 14, description: 'Number of days to extend the trial' })
  @IsInt()
  @Min(1)
  days: number;
}
