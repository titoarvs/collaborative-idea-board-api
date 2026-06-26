import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateElementDto {
  @ApiProperty({ example: 'sticky' })
  @IsString()
  type: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string

  @ApiPropertyOptional({ example: 'yellow' })
  @IsOptional()
  @IsString()
  color?: string

  @ApiPropertyOptional({ example: 'rect' })
  @IsOptional()
  @IsString()
  shape?: string | null

  @ApiProperty({ example: 120 })
  @IsInt()
  x: number

  @ApiProperty({ example: 80 })
  @IsInt()
  y: number

  @ApiPropertyOptional({ example: 192 })
  @IsOptional()
  @IsInt()
  w?: number

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @IsInt()
  h?: number

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  rotation?: number
}
