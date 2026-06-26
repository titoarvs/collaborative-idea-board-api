import { ApiProperty } from '@nestjs/swagger'
import { IsString, MaxLength, MinLength } from 'class-validator'

export class CreateCommentDto {
  @ApiProperty({ example: 'Great idea, let us scope it.' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  content: string
}
