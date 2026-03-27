import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateConnectionDto } from './create-connection.dto';

export class UpdateConnectionDto extends PartialType(CreateConnectionDto) {
  @ApiPropertyOptional({ description: 'Enable or disable this aggregator connection' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
