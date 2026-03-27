import { IsUUID, IsInt, Min, Max } from 'class-validator';

export class CartUpdateItemDto {
  @IsUUID()
  guestToken: string;

  @IsInt()
  @Min(1)
  @Max(20)
  quantity: number;
}
