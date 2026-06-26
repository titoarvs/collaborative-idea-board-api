import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

export class UpdateRoleDto {
  @ApiProperty({ example: 'admin', enum: ['admin', 'member'] })
  @IsIn(['admin', 'member'])
  role: 'admin' | 'member'
}
