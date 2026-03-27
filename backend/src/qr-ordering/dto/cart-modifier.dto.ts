import { IsUUID } from 'class-validator';

export class CartModifierDto {
  @IsUUID()
  modifierId: string;
}
