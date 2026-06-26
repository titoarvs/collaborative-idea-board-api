import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { billingSettings } from '../db/schema'
import { SecretCipher } from '../common/crypto/secret-cipher'
import { UpdateBillingSettingsDto } from './dto/update-billing-settings.dto'

export type Provider = 'dev' | 'stripe' | 'paymongo' | 'none'

export interface ResolvedBillingConfig {
  provider: Provider
  stripe: {
    secretKey: string | null
    pricePro: string | null
    webhookSecret: string | null
  }
  paymongo: {
    secretKey: string | null
    proAmount: number
    webhookSecret: string | null
  }
}

/** Non-secret view safe to expose to system admins (secrets reduced to booleans). */
export interface BillingSettingsAdminView {
  activeProvider: Provider
  encryptionConfigured: boolean
  stripe: {
    pricePro: string | null
    secretKeySet: boolean
    webhookSecretSet: boolean
  }
  paymongo: {
    proAmount: number | null
    secretKeySet: boolean
    webhookSecretSet: boolean
  }
  updatedAt: Date | null
  updatedBy: string | null
}

const SETTINGS_ID = 1
const DEFAULT_PAYMONGO_AMOUNT = 60000 // centavos

@Injectable()
export class BillingSettingsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
    private readonly cipher: SecretCipher,
  ) {}

  private async row() {
    const [row] = await this.db
      .select()
      .from(billingSettings)
      .where(eq(billingSettings.id, SETTINGS_ID))
    return row ?? null
  }

  /**
   * Effective config used by BillingService. DB values take precedence; any
   * field left unset in the DB falls back to the corresponding env var, so
   * existing env-based deployments keep working.
   */
  async getResolved(): Promise<ResolvedBillingConfig> {
    const row = await this.row()
    const env = (k: string) => this.config.get<string>(k) ?? null

    const provider =
      (row?.activeProvider as Provider | undefined) ??
      (env('BILLING_PROVIDER') as Provider | null) ??
      'dev'

    return {
      provider,
      stripe: {
        secretKey: this.cipher.decrypt(row?.stripeSecretKey) ?? env('STRIPE_SECRET_KEY'),
        pricePro: row?.stripePricePro ?? env('STRIPE_PRICE_PRO'),
        webhookSecret:
          this.cipher.decrypt(row?.stripeWebhookSecret) ??
          env('STRIPE_WEBHOOK_SECRET'),
      },
      paymongo: {
        secretKey:
          this.cipher.decrypt(row?.paymongoSecretKey) ??
          env('PAYMONGO_SECRET_KEY'),
        proAmount:
          row?.paymongoProAmount ??
          Number(env('PAYMONGO_PRO_AMOUNT') ?? DEFAULT_PAYMONGO_AMOUNT),
        webhookSecret:
          this.cipher.decrypt(row?.paymongoWebhookSecret) ??
          env('PAYMONGO_WEBHOOK_SECRET'),
      },
    }
  }

  async getAdminView(): Promise<BillingSettingsAdminView> {
    const row = await this.row()
    const env = (k: string) => Boolean(this.config.get<string>(k))

    return {
      activeProvider:
        (row?.activeProvider as Provider | undefined) ??
        (this.config.get<string>('BILLING_PROVIDER') as Provider | null) ??
        'dev',
      encryptionConfigured: this.cipher.isConfigured(),
      stripe: {
        pricePro: row?.stripePricePro ?? this.config.get<string>('STRIPE_PRICE_PRO') ?? null,
        secretKeySet: Boolean(row?.stripeSecretKey) || env('STRIPE_SECRET_KEY'),
        webhookSecretSet:
          Boolean(row?.stripeWebhookSecret) || env('STRIPE_WEBHOOK_SECRET'),
      },
      paymongo: {
        proAmount:
          row?.paymongoProAmount ??
          (this.config.get<string>('PAYMONGO_PRO_AMOUNT')
            ? Number(this.config.get<string>('PAYMONGO_PRO_AMOUNT'))
            : null),
        secretKeySet: Boolean(row?.paymongoSecretKey) || env('PAYMONGO_SECRET_KEY'),
        webhookSecretSet:
          Boolean(row?.paymongoWebhookSecret) || env('PAYMONGO_WEBHOOK_SECRET'),
      },
      updatedAt: row?.updatedAt ?? null,
      updatedBy: row?.updatedBy ?? null,
    }
  }

  async update(
    dto: UpdateBillingSettingsDto,
    updatedBy: string,
  ): Promise<BillingSettingsAdminView> {
    // Encrypt only the secrets that were actually provided (non-empty), so
    // submitting the form without re-typing a secret keeps the stored value.
    const hasSecret =
      dto.stripeSecretKey ||
      dto.stripeWebhookSecret ||
      dto.paymongoSecretKey ||
      dto.paymongoWebhookSecret
    if (hasSecret && !this.cipher.isConfigured()) {
      throw new BadRequestException(
        'Cannot store billing secrets: BILLING_ENCRYPTION_KEY is not configured on the server.',
      )
    }

    const enc = (v?: string) =>
      v && v.trim().length > 0 ? this.cipher.encrypt(v.trim()) : undefined

    const patch: Record<string, unknown> = { updatedBy, updatedAt: new Date() }
    if (dto.activeProvider !== undefined) patch.activeProvider = dto.activeProvider
    if (dto.stripePricePro !== undefined)
      patch.stripePricePro = dto.stripePricePro || null
    if (dto.paymongoProAmount !== undefined)
      patch.paymongoProAmount = dto.paymongoProAmount

    const sSecret = enc(dto.stripeSecretKey)
    if (sSecret !== undefined) patch.stripeSecretKey = sSecret
    const sHook = enc(dto.stripeWebhookSecret)
    if (sHook !== undefined) patch.stripeWebhookSecret = sHook
    const pSecret = enc(dto.paymongoSecretKey)
    if (pSecret !== undefined) patch.paymongoSecretKey = pSecret
    const pHook = enc(dto.paymongoWebhookSecret)
    if (pHook !== undefined) patch.paymongoWebhookSecret = pHook

    await this.db
      .insert(billingSettings)
      .values({ id: SETTINGS_ID, ...patch })
      .onConflictDoUpdate({ target: billingSettings.id, set: patch })

    return this.getAdminView()
  }
}
