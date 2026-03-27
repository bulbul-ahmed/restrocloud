import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class AttachModifierGroupDto {
  @ApiProperty({ example: 'uuid-of-modifier-group' })
  @IsUUID()
  modifierGroupId: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
