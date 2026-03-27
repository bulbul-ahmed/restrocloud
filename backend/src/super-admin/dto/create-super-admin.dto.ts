import { IsEmail, IsString, IsOptional, IsEnum, MinLength, MaxLength } from 'class-validator';
import { UserRole } from '@prisma/client';

const SA_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_OWNER,
  UserRole.FINANCE_ADMIN,
  UserRole.SUPPORT_MANAGER,
  UserRole.SUPPORT_AGENT,
  UserRole.ENGINEERING_ADMIN,
] as const;

export class CreateSuperAdminDto {
  @IsString()
  @MaxLength(50)
  firstName: string;

  @IsString()
  @MaxLength(50)
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: (typeof SA_ROLES)[number];
}
