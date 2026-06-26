import { ApiProperty } from '@nestjs/swagger'
import { IsEmail, IsIn } from 'class-validator'

export class InviteMemberDto {
  @ApiProperty({ example: 'teammate@company.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'member', enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member'
}
