import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { AdminService } from './admin.service'
import { SetPlanDto } from './dto/set-plan.dto'
import { ExtendTrialDto } from './dto/extend-trial.dto'
import { SystemAdminGuard } from '../common/guards/system-admin.guard'
import { BillingSettingsService } from '../billing/billing-settings.service'
import { UpdateBillingSettingsDto } from '../billing/dto/update-billing-settings.dto'
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator'

@ApiTags('admin')
@UseGuards(SystemAdminGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly admin: AdminService,
    private readonly billingSettings: BillingSettingsService,
  ) {}

  @Get('organizations')
  list() {
    return this.admin.listOrganizations()
  }

  @Patch('organizations/:id/plan')
  setPlan(@Param('id', ParseIntPipe) id: number, @Body() dto: SetPlanDto) {
    return this.admin.setPlan(id, dto.plan)
  }

  @Patch('organizations/:id/trial')
  extendTrial(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ExtendTrialDto,
  ) {
    return this.admin.extendTrial(id, dto.days)
  }

  // --- billing provider configuration -------------------------------------

  @Get('billing-settings')
  getBillingSettings() {
    return this.billingSettings.getAdminView()
  }

  @Put('billing-settings')
  updateBillingSettings(
    @CurrentUser() u: AuthUser,
    @Body() dto: UpdateBillingSettingsDto,
  ) {
    return this.billingSettings.update(dto, u.userId)
  }
}
