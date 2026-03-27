import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

export class AssignTableDto {
  @ApiPropertyOptional({ example: 'uuid-of-table', description: 'Set null to remove table assignment' })
  @IsOptional()
  @IsUUID()
  tableId?: string;

  @ApiPropertyOptional({ example: 'uuid-of-session', description: 'Table session ID' })
  @IsOptional()
  @IsUUID()
  tableSessionId?: string;
}
