import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { TableStatus } from '@prisma/client';

export class UpdateTableStatusDto {
  @ApiProperty({ enum: TableStatus, example: TableStatus.CLEANING })
  @IsEnum(TableStatus)
  status: TableStatus;
}
