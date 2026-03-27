import { IsOptional, IsString, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitProofDto {
  @ApiPropertyOptional({ description: 'URL of delivery proof photo' })
  @IsOptional()
  @IsString()
  proofUrl?: string;

  @ApiPropertyOptional({ description: 'Notes about delivery proof' })
  @IsOptional()
  @IsString()
  proofNotes?: string;
}
