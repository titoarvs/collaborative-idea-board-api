import { Module } from '@nestjs/common'
import { BillingController } from './billing.controller'
import { BillingService } from './billing.service'
import { BillingSettingsService } from './billing-settings.service'
import { SecretCipher } from '../common/crypto/secret-cipher'
import { OrganizationsModule } from '../organizations/organizations.module'

@Module({
  imports: [OrganizationsModule],
  controllers: [BillingController],
  providers: [BillingService, BillingSettingsService, SecretCipher],
  exports: [BillingSettingsService],
})
export class BillingModule {}
