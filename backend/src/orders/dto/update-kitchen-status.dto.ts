import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { KitchenStatus } from '@prisma/client';

export class UpdateKitchenStatusDto {
  @ApiProperty({ enum: KitchenStatus })
  @IsEnum(KitchenStatus)
  kitchenStatus: KitchenStatus;
}
