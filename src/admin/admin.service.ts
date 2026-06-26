import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { eq, sql } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import {
  organizations,
  organizationMembers,
  teams,
  user,
} from '../db/schema'
import type { Plan } from '../common/billing/plans'

const SUBSCRIPTION_DAYS = 30

@Injectable()
export class AdminService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async listOrganizations() {
    const orgs = await this.db.select().from(organizations)

    const result = []
    for (const org of orgs) {
      const [boards] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(teams)
        .where(eq(teams.organizationId, org.id))
      const [members] = await this.db
        .select({ value: sql<number>`count(*)::int` })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, org.id))
      const [owner] = await this.db
        .select({ email: user.email })
        .from(user)
        .where(eq(user.id, org.ownerId))

      result.push({
        id: org.id,
        name: org.name,
        plan: org.plan as Plan,
        status: org.status,
        trialEndsAt: org.trialEndsAt,
        boardCount: boards?.value ?? 0,
        memberCount: members?.value ?? 0,
        ownerEmail: owner?.email ?? null,
        createdAt: org.createdAt,
      })
    }
    return result
  }

  async setPlan(orgId: number, plan: Plan) {
    const patch =
      plan === 'pro'
        ? {
            plan: 'pro',
            status: 'active',
            cancelAtPeriodEnd: false,
            currentPeriodEnd: new Date(
              Date.now() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000,
            ),
          }
        : { plan: 'free', status: 'canceled', cancelAtPeriodEnd: false }

    const [updated] = await this.db
      .update(organizations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning()
    if (!updated) throw new NotFoundException('Organization not found')
    return { ok: true }
  }

  async extendTrial(orgId: number, days: number) {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
    if (!org) throw new NotFoundException('Organization not found')

    const base = org.trialEndsAt && org.trialEndsAt.getTime() > Date.now()
      ? org.trialEndsAt.getTime()
      : Date.now()
    const trialEndsAt = new Date(base + days * 24 * 60 * 60 * 1000)

    await this.db
      .update(organizations)
      .set({
        plan: 'pro',
        status: 'trialing',
        trialEndsAt,
        updatedAt: new Date(),
      })
      .where(eq(organizations.id, orgId))
    return { ok: true, trialEndsAt }
  }
}
