import { ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator'

export class UpdateElementDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  color?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  x?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  y?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  w?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  h?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  rotation?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  z?: number
}
