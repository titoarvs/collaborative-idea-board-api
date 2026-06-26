import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator'

/**
 * All fields optional. Secret fields are only updated when a non-empty value is
 * sent; omit them to keep the stored secret unchanged.
 */
export class UpdateBillingSettingsDto {
  @ApiPropertyOptional({ enum: ['dev', 'stripe', 'paymongo', 'none'] })
  @IsOptional()
  @IsIn(['dev', 'stripe', 'paymongo', 'none'])
  activeProvider?: 'dev' | 'stripe' | 'paymongo' | 'none'

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeSecretKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripePricePro?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stripeWebhookSecret?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymongoSecretKey?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  paymongoProAmount?: number

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  paymongoWebhookSecret?: string
}
