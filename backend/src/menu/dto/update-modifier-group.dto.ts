import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateModifierGroupDto } from './create-modifier-group.dto';

export class UpdateModifierGroupDto extends PartialType(
  OmitType(CreateModifierGroupDto, ['modifiers'] as const),
) {}
