import { HttpException, HttpStatus } from '@nestjs/common'

export type Plan = 'free' | 'pro'

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired'

export interface PlanLimit {
  boards: number
  retro: boolean
}

/** Server-side source of truth for plan limits. */
export const PLAN_LIMITS: Record<Plan, PlanLimit> = {
  free: { boards: 1, retro: false },
  pro: { boards: 10, retro: true },
}

export const TRIAL_DAYS = 30

export type PlanErrorCode = 'BOARD_LIMIT' | 'PLAN_REQUIRED' | 'TRIAL_EXPIRED'

/**
 * Error the frontend recognizes via its `{ code }` field to show an upgrade
 * prompt. Defaults to HTTP 402 (Payment Required); retro gating uses 403.
 */
export class PlanLimitException extends HttpException {
  constructor(
    code: PlanErrorCode,
    message: string,
    status: HttpStatus = HttpStatus.PAYMENT_REQUIRED,
  ) {
    super({ statusCode: status, code, message }, status)
  }
}

export interface OrgPlanState {
  plan: Plan
  status: SubscriptionStatus
  trialEndsAt: Date | null
}

export interface Entitlements {
  /** Effective plan after accounting for an expired, unpaid trial. */
  plan: Plan
  boardLimit: number
  retroEnabled: boolean
  /** Free org whose trial has lapsed: writes blocked until upgrade. */
  isLocked: boolean
}

/**
 * Compute effective entitlements from stored plan state. A `trialing` org whose
 * `trialEndsAt` has passed (and never converted to `active`) is treated as a
 * locked Free org.
 */
export function computeEntitlements(state: OrgPlanState): Entitlements {
  const trialExpired =
    state.status === 'trialing' &&
    state.trialEndsAt !== null &&
    state.trialEndsAt.getTime() <= Date.now()

  const isLocked = state.status === 'expired' || trialExpired
  const effectivePlan: Plan = isLocked ? 'free' : state.plan
  const limits = PLAN_LIMITS[effectivePlan]

  return {
    plan: effectivePlan,
    boardLimit: limits.boards,
    retroEnabled: limits.retro && !isLocked,
    isLocked,
  }
}
