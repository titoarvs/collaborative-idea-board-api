import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import { BillingService } from './billing.service'
import { CheckoutDto, PortalDto } from './dto/checkout.dto'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  checkout(@CurrentUser() u: AuthUser, @Body() dto: CheckoutDto) {
    return this.billing.createCheckout(dto.organizationId, u.userId)
  }

  @Post('portal')
  @HttpCode(HttpStatus.OK)
  portal(@CurrentUser() u: AuthUser, @Body() dto: PortalDto) {
    return this.billing.createPortal(dto.organizationId, u.userId)
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Req() req: Request & { rawBody?: Buffer }) {
    return this.billing.handleWebhook(
      req.rawBody,
      req.headers as Record<string, string | string[] | undefined>,
      req.body,
    )
  }
}
