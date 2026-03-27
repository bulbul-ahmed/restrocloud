import { IsUUID } from 'class-validator';

export class RequestBillDto {
  @IsUUID()
  guestToken: string;
}
