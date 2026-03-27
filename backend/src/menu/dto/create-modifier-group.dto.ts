import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  Min,
  Max,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateModifierDto } from './create-modifier.dto';

export class CreateModifierGroupDto {
  @ApiProperty({ example: 'Size', description: 'e.g. Size, Toppings, Spice Level' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 0, description: 'Minimum modifiers customer must select' })
  @IsOptional()
  @IsInt()
  @Min(0)
  minSelect?: number;

  @ApiPropertyOptional({ example: 1, description: 'Maximum modifiers customer can select' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  maxSelect?: number;

  @ApiPropertyOptional({ example: false, description: 'Whether selection is mandatory' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    type: [CreateModifierDto],
    description: 'Optional: create modifiers inline with the group',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateModifierDto)
  modifiers?: CreateModifierDto[];

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'If set, this group is a child of the given modifier (nested sub-options)',
  })
  @IsOptional()
  @IsUUID()
  parentModifierId?: string;
}
