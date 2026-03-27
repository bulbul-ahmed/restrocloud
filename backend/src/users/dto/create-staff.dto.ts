import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

const STAFF_ROLES = [
  UserRole.MANAGER,
  UserRole.CASHIER,
  UserRole.WAITER,
  UserRole.KITCHEN,
  UserRole.DRIVER,
  UserRole.STAFF,
];

export class CreateStaffDto {
  @ApiProperty({ example: 'Ahmed' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Rahman' })
  @IsString()
  lastName: string;

  @ApiPropertyOptional({ example: 'waiter@spicegarden.bd' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+8801812345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ example: 'TempPass123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ enum: STAFF_ROLES, example: UserRole.WAITER })
  @IsEnum(STAFF_ROLES, {
    message: `role must be one of: ${STAFF_ROLES.join(', ')}`,
  })
  role: UserRole;

  @ApiPropertyOptional({ example: 'e5b2b950-3616-4cc2-aa67-9aace63b05eb', description: 'Assign to specific restaurant (defaults to first restaurant in tenant)' })
  @IsOptional()
  @IsUUID()
  restaurantId?: string;
}
