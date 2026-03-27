import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsUUID } from 'class-validator';

export class BulkAvailabilityDto {
  @ApiProperty({ example: ['uuid1', 'uuid2'], description: 'Item IDs to update' })
  @IsArray()
  @IsUUID('4', { each: true })
  itemIds: string[];

  @ApiProperty({ example: false })
  @IsBoolean()
  isAvailable: boolean;
}
