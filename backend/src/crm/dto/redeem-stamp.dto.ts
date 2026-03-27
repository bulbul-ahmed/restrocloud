import { IsUUID } from 'class-validator';

export class RedeemStampDto {
  @IsUUID()
  customerId: string;

  @IsUUID()
  stampCardId: string;
}
