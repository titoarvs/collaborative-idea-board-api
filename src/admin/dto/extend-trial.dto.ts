import { ApiProperty } from '@nestjs/swagger'
import { IsInt, Max, Min } from 'class-validator'

export class ExtendTrialDto {
  @ApiProperty({ example: 30 })
  @IsInt()
  @Min(1)
  @Max(365)
  days: number
}
