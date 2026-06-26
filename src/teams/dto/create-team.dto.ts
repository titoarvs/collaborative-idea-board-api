import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateTeamDto {
  @ApiProperty({ example: 'Platform Squad' })
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string

  @ApiPropertyOptional({ example: 'Weekly product retros' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string
}
