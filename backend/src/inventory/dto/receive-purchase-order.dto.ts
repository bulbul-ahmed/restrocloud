import { Type } from 'class-transformer';
import { IsArray, IsPositive, IsUUID, ValidateNested } from 'class-validator';

export class ReceivePOItemDto {
  @IsUUID()
  purchaseOrderItemId: string;

  @IsPositive()
  receivedQty: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReceivePOItemDto)
  items: ReceivePOItemDto[];
}
