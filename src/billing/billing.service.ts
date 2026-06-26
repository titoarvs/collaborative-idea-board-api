import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'crypto'
import { eq } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { organizations } from '../db/schema'
import { OrganizationsService } from '../organizations/organizations.service'
import {
  BillingSettingsService,
  type ResolvedBillingConfig,
} from './billing-settings.service'

const SUBSCRIPTION_DAYS = 30

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly orgs: OrganizationsService,
    private readonly config: ConfigService,
    private readonly settings: BillingSettingsService,
  ) {}

  private get frontendUrl(): string {
    return this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000'
  }

  // --- org state transitions ----------------------------------------------

  private async activatePro(
    orgId: number,
    opts: {
      provider?: string
      customerId?: string
      subscriptionId?: string
      currentPeriodEnd?: Date
      cancelAtPeriodEnd?: boolean
    } = {},
  ) {
    await this.db
      .update(organizations)
      .set({
        plan: 'pro',
        status: 'active',
        cancelAtPeriodEnd: opts.cancelAtPeriodEnd ?? false,
        currentPeriodEnd:
          opts.currentPeriodEnd ??
          new Date(Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000),
        billingProvider: opts.provider,
        billingCustomerId: opts.customerId ?? undefined,
        billingSubscriptionId: opts.subscriptionId ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
  }

  private async cancelPlan(orgId: number) {
    await this.db
      .update(organizations)
      .set({
        plan: 'free',
        status: 'canceled',
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
  }

  // --- checkout / portal ---------------------------------------------------

  async createCheckout(orgId: number, userId: string): Promise<{ url: string }> {
    await this.orgs.assertManager(orgId, userId)
    const cfg = await this.settings.getResolved()
    const successUrl = `${this.frontendUrl}/billing?status=success`
    const cancelUrl = `${this.frontendUrl}/billing?status=cancel`

    if (cfg.provider === 'stripe') {
      return { url: await this.stripeCheckout(cfg, orgId, successUrl, cancelUrl) }
    }
    if (cfg.provider === 'paymongo') {
      return { url: await this.paymongoCheckout(cfg, orgId, successUrl, cancelUrl) }
    }
    if (cfg.provider === 'none') {
      throw new BadRequestException('Billing is not enabled')
    }

    // dev provider: simulate an instant successful payment.
    await this.activatePro(orgId, { provider: 'dev' })
    this.logger.warn(
      `BILLING_PROVIDER=dev: org ${orgId} upgraded to Pro without real payment.`,
    )
    return { url: successUrl }
  }

  async createPortal(orgId: number, userId: string): Promise<{ url: string }> {
    await this.orgs.assertManager(orgId, userId)
    const cfg = await this.settings.getResolved()

    if (cfg.provider === 'stripe') {
      return { url: await this.stripePortal(cfg, orgId) }
    }
    // PayMongo has no hosted portal; fall back to the in-app billing page.
    return { url: `${this.frontendUrl}/billing` }
  }

  // --- Stripe --------------------------------------------------------------

  private async stripeCheckout(
    cfg: ResolvedBillingConfig,
    orgId: number,
    success: string,
    cancel: string,
  ) {
    const key = cfg.stripe.secretKey
    const price = cfg.stripe.pricePro
    if (!key || !price) {
      throw new BadRequestException('Stripe is not configured')
    }
    const body = new URLSearchParams({
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      success_url: success,
      cancel_url: cancel,
      client_reference_id: String(orgId),
      'metadata[organizationId]': String(orgId),
      'subscription_data[metadata][organizationId]': String(orgId),
    })
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const json = (await res.json()) as { url?: string; error?: { message: string } }
    if (!res.ok || !json.url) {
      throw new BadRequestException(json.error?.message ?? 'Stripe checkout failed')
    }
    return json.url
  }

  private async stripePortal(cfg: ResolvedBillingConfig, orgId: number) {
    const key = cfg.stripe.secretKey
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
    if (!key || !org?.billingCustomerId) {
      throw new BadRequestException('No active Stripe customer for this org')
    }
    const body = new URLSearchParams({
      customer: org.billingCustomerId,
      return_url: `${this.frontendUrl}/billing`,
    })
    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    })
    const json = (await res.json()) as { url?: string; error?: { message: string } }
    if (!res.ok || !json.url) {
      throw new BadRequestException(json.error?.message ?? 'Stripe portal failed')
    }
    return json.url
  }

  // --- PayMongo ------------------------------------------------------------

  private async paymongoCheckout(
    cfg: ResolvedBillingConfig,
    orgId: number,
    success: string,
    cancel: string,
  ) {
    const key = cfg.paymongo.secretKey
    const amount = cfg.paymongo.proAmount // centavos
    if (!key) throw new BadRequestException('PayMongo is not configured')

    const auth = Buffer.from(`${key}:`).toString('base64')
    const res = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            line_items: [
              { name: 'IdeaBoard Pro', amount, currency: 'PHP', quantity: 1 },
            ],
            payment_method_types: ['card', 'gcash', 'paymaya'],
            success_url: success,
            cancel_url: cancel,
            description: `IdeaBoard Pro subscription for org ${orgId}`,
            metadata: { organizationId: String(orgId) },
          },
        },
      }),
    })
    const json = (await res.json()) as {
      data?: { attributes?: { checkout_url?: string } }
      errors?: { detail: string }[]
    }
    const url = json.data?.attributes?.checkout_url
    if (!res.ok || !url) {
      throw new BadRequestException(
        json.errors?.[0]?.detail ?? 'PayMongo checkout failed',
      )
    }
    return url
  }

  // --- webhooks ------------------------------------------------------------

  async handleWebhook(
    rawBody: Buffer | undefined,
    headers: Record<string, string | string[] | undefined>,
    parsed: unknown,
  ) {
    const cfg = await this.settings.getResolved()
    if (cfg.provider === 'stripe') {
      this.verifyStripeSignature(cfg, rawBody, headers['stripe-signature'])
      return this.handleStripeEvent(parsed)
    }
    if (cfg.provider === 'paymongo') {
      this.verifyPaymongoSignature(cfg, rawBody, headers['paymongo-signature'])
      return this.handlePaymongoEvent(parsed)
    }
    // dev/none: nothing to do (checkout already activated the org if dev).
    return { received: true }
  }

  private verifyStripeSignature(
    cfg: ResolvedBillingConfig,
    rawBody: Buffer | undefined,
    header: string | string[] | undefined,
  ) {
    const secret = cfg.stripe.webhookSecret
    if (!secret) return // verification disabled if no secret configured
    const sig = Array.isArray(header) ? header[0] : header
    if (!rawBody || !sig) throw new BadRequestException('Missing signature')
    const parts = Object.fromEntries(
      sig.split(',').map((p) => p.split('=') as [string, string]),
    )
    const expected = createHmac('sha256', secret)
      .update(`${parts.t}.${rawBody.toString('utf8')}`)
      .digest('hex')
    if (!this.safeEqual(expected, parts.v1)) {
      throw new BadRequestException('Invalid Stripe signature')
    }
  }

  private verifyPaymongoSignature(
    cfg: ResolvedBillingConfig,
    rawBody: Buffer | undefined,
    header: string | string[] | undefined,
  ) {
    const secret = cfg.paymongo.webhookSecret
    if (!secret) return
    const sig = Array.isArray(header) ? header[0] : header
    if (!rawBody || !sig) throw new BadRequestException('Missing signature')
    const parts = Object.fromEntries(
      sig.split(',').map((p) => p.split('=') as [string, string]),
    )
    const signedPayload = `${parts.t}.${rawBody.toString('utf8')}`
    const expected = createHmac('sha256', secret).update(signedPayload).digest('hex')
    if (!this.safeEqual(expected, parts.te ?? parts.li)) {
      throw new BadRequestException('Invalid PayMongo signature')
    }
  }

  private safeEqual(a: string, b: string | undefined) {
    if (!b) return false
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    return ba.length === bb.length && timingSafeEqual(ba, bb)
  }

  private async handleStripeEvent(parsed: unknown) {
    const event = parsed as {
      type?: string
      data?: { object?: Record<string, unknown> }
    }
    const obj = event.data?.object ?? {}
    const orgId = this.extractOrgId(obj)

    switch (event.type) {
      case 'checkout.session.completed':
        if (orgId) {
          await this.activatePro(orgId, {
            provider: 'stripe',
            customerId: obj.customer as string | undefined,
            subscriptionId: obj.subscription as string | undefined,
          })
        }
        break
      case 'customer.subscription.updated': {
        const periodEnd = obj.current_period_end as number | undefined
        if (orgId) {
          await this.activatePro(orgId, {
            provider: 'stripe',
            subscriptionId: obj.id as string | undefined,
            cancelAtPeriodEnd: Boolean(obj.cancel_at_period_end),
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : undefined,
          })
        }
        break
      }
      case 'customer.subscription.deleted':
        if (orgId) await this.cancelPlan(orgId)
        break
      default:
        break
    }
    return { received: true }
  }

  private async handlePaymongoEvent(parsed: unknown) {
    const event = parsed as {
      data?: {
        attributes?: {
          type?: string
          data?: { attributes?: { metadata?: Record<string, string> } }
        }
      }
    }
    const attrs = event.data?.attributes
    const orgId = Number(attrs?.data?.attributes?.metadata?.organizationId)
    if (
      attrs?.type === 'checkout_session.payment.paid' &&
      Number.isFinite(orgId)
    ) {
      await this.activatePro(orgId, { provider: 'paymongo' })
    }
    return { received: true }
  }

  private extractOrgId(obj: Record<string, unknown>): number | null {
    const metadata = obj.metadata as Record<string, string> | undefined
    const fromMeta = metadata?.organizationId
    const fromRef = obj.client_reference_id as string | undefined
    const id = Number(fromMeta ?? fromRef)
    return Number.isFinite(id) ? id : null
  }
}
