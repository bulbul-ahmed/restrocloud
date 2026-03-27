import { IsEmail } from 'class-validator';

export class GdprDeleteUserDto {
  @IsEmail()
  customerEmail: string;
}
