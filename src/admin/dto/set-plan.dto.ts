import { ApiProperty } from '@nestjs/swagger'
import { IsIn } from 'class-validator'

export class SetPlanDto {
  @ApiProperty({ example: 'pro', enum: ['free', 'pro'] })
  @IsIn(['free', 'pro'])
  plan: 'free' | 'pro'
}
