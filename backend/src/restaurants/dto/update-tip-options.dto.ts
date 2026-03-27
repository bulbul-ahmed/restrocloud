import { IsArray, IsNumber, IsBoolean, Min, Max, ArrayMaxSize } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateTipOptionsDto {
  @ApiProperty({
    example: [10, 15, 20],
    description: 'Suggested tip percentages shown at checkout (max 5 options)',
  })
  @IsArray()
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  @Max(100, { each: true })
  @ArrayMaxSize(5)
  tipPercentages: number[];

  @ApiPropertyOptional({
    example: true,
    description: 'Allow customer to enter a custom tip amount',
  })
  @IsBoolean()
  allowCustom: boolean;
}
