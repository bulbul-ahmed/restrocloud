import { IsString, MinLength } from 'class-validator';

export class AddTicketMessageDto {
  @IsString()
  @MinLength(1)
  content: string;
}
