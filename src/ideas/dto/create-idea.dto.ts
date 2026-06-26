import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateIdeaDto {
  @ApiProperty({ example: 'Add dark mode' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  title: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string
}
