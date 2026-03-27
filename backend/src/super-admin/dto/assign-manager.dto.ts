import { IsOptional, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class AssignManagerDto {
  @ApiPropertyOptional({ example: 'uuid-of-super-admin', description: 'Super admin user ID to assign, or null to unassign' })
  @IsOptional()
  @IsUUID()
  managerId?: string | null;
}
