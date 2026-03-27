import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class AddStampDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  stampCardId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  count?: number;
}
