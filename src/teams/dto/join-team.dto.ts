import { ApiProperty } from '@nestjs/swagger'
import { IsString, MinLength } from 'class-validator'

export class JoinTeamDto {
  @ApiProperty({ example: 'A1B2C3' })
  @IsString()
  @MinLength(1)
  inviteCode: string
}
