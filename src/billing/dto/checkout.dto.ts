import { ApiProperty } from '@nestjs/swagger'
import { IsIn, IsInt } from 'class-validator'

export class CheckoutDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  organizationId: number

  @ApiProperty({ example: 'pro', enum: ['pro'] })
  @IsIn(['pro'])
  plan: 'pro'
}

export class PortalDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  organizationId: number
}
