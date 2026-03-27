import { IsString, IsOptional, IsEmail, IsPhoneNumber, MaxLength, IsUUID } from 'class-validator';

export class IdentifyGuestDto {
  @IsUUID()
  guestToken: string;

  @IsString()
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
