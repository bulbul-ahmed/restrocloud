import { PartialType } from '@nestjs/mapped-types';
import { CreateStampCardDto } from './create-stamp-card.dto';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateStampCardDto extends PartialType(CreateStampCardDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
