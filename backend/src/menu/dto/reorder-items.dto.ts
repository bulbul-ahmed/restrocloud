import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsUUID, IsInt, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderEntryDto {
  @ApiProperty({ example: 'uuid-of-item' })
  @IsUUID()
  id: string;

  @ApiProperty({ example: 0, description: 'New sort order (0 = first)' })
  @IsInt()
  @Min(0)
  sortOrder: number;
}

export class ReorderDto {
  @ApiProperty({ type: [ReorderEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderEntryDto)
  items: ReorderEntryDto[];
}
