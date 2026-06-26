import { ApiProperty } from '@nestjs/swagger'
import { IsInt, IsString, Min } from 'class-validator'

export class MoveIdeaDto {
  @ApiProperty({ example: 'in-progress' })
  @IsString()
  status: string

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  position: number
}
