import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import {
  organizations,
  organizationMembers,
  organizationInvites,
  teams,
  user,
} from '../db/schema'
import {
  PLAN_LIMITS,
  PlanLimitException,
  TRIAL_DAYS,
  computeEntitlements,
  type Entitlements,
  type Plan,
  type SubscriptionStatus,
} from '../common/billing/plans'

type OrgRow = typeof organizations.$inferSelect
export type OrgRole = 'owner' | 'admin' | 'member'

@Injectable()
export class OrganizationsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // --- membership / access -------------------------------------------------

  async getMembership(orgId: number, userId: string) {
    const [m] = await this.db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, userId),
        ),
      )
    return m ?? null
  }

  async assertMember(orgId: number, userId: string) {
    const m = await this.getMembership(orgId, userId)
    if (!m) throw new ForbiddenException('Not a member of this organization')
    return m
  }

  async assertManager(orgId: number, userId: string) {
    const m = await this.assertMember(orgId, userId)
    if (m.role !== 'owner' && m.role !== 'admin') {
      throw new ForbiddenException('Requires owner or admin role')
    }
    return m
  }

  // --- entitlements --------------------------------------------------------

  private async boardCount(orgId: number) {
    const [row] = await this.db
      .select({ value: sql<number>`count(*)::int` })
      .from(teams)
      .where(eq(teams.organizationId, orgId))
    return row?.value ?? 0
  }

  /**
   * Load an org and, if its trial has lapsed without converting to a paid
   * subscription, persist the downgrade to a locked Free plan.
   */
  private async getReconciledOrg(orgId: number): Promise<OrgRow> {
    const [org] = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.id, orgId))
    if (!org) throw new NotFoundException('Organization not found')
    return this.reconcile(org)
  }

  private async reconcile(org: OrgRow): Promise<OrgRow> {
    const trialLapsed =
      org.status === 'trialing' &&
      org.trialEndsAt !== null &&
      org.trialEndsAt.getTime() <= Date.now()

    if (!trialLapsed) return org

    const [updated] = await this.db
      .update(organizations)
      .set({ plan: 'free', status: 'expired', updatedAt: new Date() })
      .where(eq(organizations.id, org.id))
      .returning()
    return updated
  }

  async getEntitlements(orgId: number): Promise<Entitlements> {
    const org = await this.getReconciledOrg(orgId)
    return computeEntitlements({
      plan: org.plan as Plan,
      status: org.status as SubscriptionStatus,
      trialEndsAt: org.trialEndsAt,
    })
  }

  /** Throws BOARD_LIMIT / TRIAL_EXPIRED if the org cannot add another board. */
  async assertCanCreateBoard(orgId: number) {
    const ent = await this.getEntitlements(orgId)
    if (ent.isLocked) {
      throw new PlanLimitException(
        'TRIAL_EXPIRED',
        'Your trial has ended. Upgrade to continue.',
      )
    }
    const count = await this.boardCount(orgId)
    if (count >= ent.boardLimit) {
      throw new PlanLimitException(
        'BOARD_LIMIT',
        `Your plan allows ${ent.boardLimit} board${ent.boardLimit === 1 ? '' : 's'}.`,
      )
    }
  }

  /** Throws PLAN_REQUIRED (403) when the org's plan does not include retro. */
  async assertRetroEnabled(orgId: number | null) {
    if (orgId === null) {
      throw new PlanLimitException(
        'PLAN_REQUIRED',
        'Retro requires a Pro organization.',
        HttpStatus.FORBIDDEN,
      )
    }
    const ent = await this.getEntitlements(orgId)
    if (!ent.retroEnabled) {
      throw new PlanLimitException(
        ent.isLocked ? 'TRIAL_EXPIRED' : 'PLAN_REQUIRED',
        'The retro whiteboard is a Pro feature.',
        HttpStatus.FORBIDDEN,
      )
    }
  }

  // --- views ---------------------------------------------------------------

  private async toView(org: OrgRow, role: OrgRole) {
    const boardCount = await this.boardCount(org.id)
    return {
      id: org.id,
      name: org.name,
      plan: org.plan as Plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt,
      boardCount,
      role,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    }
  }

  // --- CRUD ----------------------------------------------------------------

  async listMine(userId: string) {
    const memberships = await this.db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, userId))

    if (memberships.length === 0) return []

    const orgIds = memberships.map((m) => m.organizationId)
    const rows = await this.db
      .select()
      .from(organizations)
      .where(inArray(organizations.id, orgIds))

    const roleByOrg = new Map(memberships.map((m) => [m.organizationId, m.role]))

    const views = []
    for (const row of rows) {
      const reconciled = await this.reconcile(row)
      views.push(
        await this.toView(
          reconciled,
          (roleByOrg.get(row.id) as OrgRole) ?? 'member',
        ),
      )
    }
    return views
  }

  async create(userId: string, name: string) {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000)
    const [org] = await this.db
      .insert(organizations)
      .values({
        name,
        ownerId: userId,
        plan: 'pro',
        status: 'trialing',
        trialEndsAt,
      })
      .returning()

    await this.db.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: 'owner',
    })

    return this.toView(org, 'owner')
  }

  async getOne(orgId: number, userId: string) {
    const m = await this.assertMember(orgId, userId)
    const org = await this.getReconciledOrg(orgId)
    return this.toView(org, m.role as OrgRole)
  }

  async update(orgId: number, userId: string, name: string) {
    await this.assertManager(orgId, userId)
    const [org] = await this.db
      .update(organizations)
      .set({ name, updatedAt: new Date() })
      .where(eq(organizations.id, orgId))
      .returning()
    const m = await this.getMembership(orgId, userId)
    return this.toView(org, (m?.role as OrgRole) ?? 'member')
  }

  // --- members & invites ---------------------------------------------------

  async getMembers(orgId: number, userId: string) {
    await this.assertMember(orgId, userId)
    return this.db
      .select({
        userId: organizationMembers.userId,
        name: user.name,
        email: user.email,
        image: user.image,
        role: organizationMembers.role,
      })
      .from(organizationMembers)
      .leftJoin(user, eq(organizationMembers.userId, user.id))
      .where(eq(organizationMembers.organizationId, orgId))
  }

  async invite(orgId: number, actingUserId: string, email: string, role: OrgRole) {
    await this.assertManager(orgId, actingUserId)
    if (role === 'owner') {
      throw new BadRequestException('Cannot invite a member as owner')
    }
    const normalized = email.toLowerCase()

    // If the user already exists, add them directly; otherwise store an invite.
    const [existingUser] = await this.db
      .select()
      .from(user)
      .where(eq(user.email, normalized))

    if (existingUser) {
      const already = await this.getMembership(orgId, existingUser.id)
      if (!already) {
        await this.db.insert(organizationMembers).values({
          organizationId: orgId,
          userId: existingUser.id,
          role,
        })
      }
      return { ok: true, added: true }
    }

    const token = randomBytes(24).toString('hex')
    await this.db.insert(organizationInvites).values({
      organizationId: orgId,
      email: normalized,
      role,
      token,
      invitedBy: actingUserId,
    })
    return { ok: true, added: false, token }
  }

  async updateMemberRole(
    orgId: number,
    actingUserId: string,
    targetUserId: string,
    role: OrgRole,
  ) {
    await this.assertManager(orgId, actingUserId)
    if (role === 'owner') {
      throw new BadRequestException('Cannot assign the owner role')
    }
    const target = await this.getMembership(orgId, targetUserId)
    if (!target) throw new NotFoundException('Member not found')
    if (target.role === 'owner') {
      throw new ForbiddenException('Cannot change the owner role')
    }
    await this.db
      .update(organizationMembers)
      .set({ role })
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      )
    return { ok: true }
  }

  async removeMember(orgId: number, actingUserId: string, targetUserId: string) {
    await this.assertManager(orgId, actingUserId)
    const target = await this.getMembership(orgId, targetUserId)
    if (!target) throw new NotFoundException('Member not found')
    if (target.role === 'owner') {
      throw new ForbiddenException('Cannot remove the owner')
    }
    await this.db
      .delete(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, targetUserId),
        ),
      )
    return { ok: true }
  }

  // --- subscription view ---------------------------------------------------

  async getSubscription(orgId: number, userId: string) {
    await this.assertMember(orgId, userId)
    const org = await this.getReconciledOrg(orgId)
    return {
      plan: org.plan as Plan,
      status: org.status,
      trialEndsAt: org.trialEndsAt,
      currentPeriodEnd: org.currentPeriodEnd,
      cancelAtPeriodEnd: org.cancelAtPeriodEnd,
    }
  }

  /** Limits exposed for clients that want to render plan comparisons. */
  get planLimits() {
    return PLAN_LIMITS
  }
}
