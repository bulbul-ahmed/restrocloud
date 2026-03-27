import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantNoteDto {
  @ApiProperty({ example: 'Owner called to discuss upgrade. Follow up next week.' })
  @IsString()
  @MinLength(1)
  content: string;
}
