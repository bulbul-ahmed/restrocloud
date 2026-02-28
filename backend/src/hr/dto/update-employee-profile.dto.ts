import { IsOptional, IsString, IsNumber, Min, IsIn, IsISO8601 } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class UpdateEmployeeProfileDto {
  @ApiPropertyOptional({ example: '2022-06-01' })
  @IsOptional()
  @IsISO8601()
  hireDate?: string;

  @ApiPropertyOptional({ enum: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR'] })
  @IsOptional()
  @IsIn(['FULL_TIME', 'PART_TIME', 'CONTRACTOR'])
  employmentType?: string;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  hourlyRate?: number;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  monthlySalary?: number;

  @ApiPropertyOptional({ example: 'Rahim Hossain' })
  @IsOptional()
  @IsString()
  emergencyContact?: string;

  @ApiPropertyOptional({ example: '+8801712345678' })
  @IsOptional()
  @IsString()
  emergencyPhone?: string;

  @ApiPropertyOptional({ example: 'BRAC Bank, AC: 1234567890' })
  @IsOptional()
  @IsString()
  bankAccount?: string;

  @ApiPropertyOptional({ example: 'Reliable, punctual' })
  @IsOptional()
  @IsString()
  hrNotes?: string;
}
