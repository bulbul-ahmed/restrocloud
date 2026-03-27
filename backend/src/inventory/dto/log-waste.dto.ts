import { IsEnum, IsOptional, IsPositive, IsString, IsUUID } from 'class-validator';

export enum WasteReason {
  SPOILAGE = 'SPOILAGE',
  OVERCOOKED = 'OVERCOOKED',
  DROPPED = 'DROPPED',
  EXPIRED = 'EXPIRED',
  OTHER = 'OTHER',
}

export class LogWasteDto {
  @IsUUID()
  ingredientId: string;

  @IsPositive()
  quantity: number;

  @IsEnum(WasteReason)
  reason: WasteReason;

  @IsOptional()
  @IsString()
  notes?: string;
}
