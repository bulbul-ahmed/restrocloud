import { IsArray, IsEnum, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderType } from '@prisma/client';

export class UpdateOrderTypesDto {
  @ApiProperty({
    enum: OrderType,
    isArray: true,
    example: ['DINE_IN', 'TAKEAWAY'],
    description: 'Enabled order channels. At least one required.',
  })
  @IsArray()
  @IsEnum(OrderType, { each: true })
  @ArrayMinSize(1)
  orderTypes: OrderType[];
}
