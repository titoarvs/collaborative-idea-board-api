import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { asc, eq, sql } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { canvasElements, user } from '../db/schema'
import { TeamsService } from '../teams/teams.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import type { CreateElementDto } from './dto/create-element.dto'
import type { UpdateElementDto } from './dto/update-element.dto'

const ELEMENT_LABELS: Record<string, string> = {
  sticky: 'a sticky note',
  text: 'a text',
  shape: 'a shape',
  line: 'a line',
  frame: 'a frame',
  stamp: 'a stamp',
}

const DEFAULT_FRAMES = [
  { type: 'frame', content: 'Good', color: 'green', x: 40, y: 40, w: 460, h: 620 },
  { type: 'frame', content: 'Bad / could be better', color: 'rose', x: 540, y: 40, w: 460, h: 620 },
  { type: 'frame', content: 'Ideas', color: 'sky', x: 1040, y: 40, w: 460, h: 620 },
]

@Injectable()
export class CanvasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly teams: TeamsService,
    private readonly orgs: OrganizationsService,
    private readonly realtime: RealtimeGateway
  ) {}

  /**
   * Retro is a Pro feature. Verify membership, then that the board's
   * organization is entitled to retro (throws PLAN_REQUIRED otherwise).
   */
  private async assertRetroAccess(teamId: number, userId: string) {
    await this.teams.assertMember(teamId, userId)
    const orgId = await this.teams.getOrganizationId(teamId)
    await this.orgs.assertRetroEnabled(orgId)
  }

  async listElements(teamId: number, userId: string) {
    await this.assertRetroAccess(teamId, userId)
    return this.db
      .select({
        id: canvasElements.id,
        teamId: canvasElements.teamId,
        userId: canvasElements.userId,
        type: canvasElements.type,
        content: canvasElements.content,
        color: canvasElements.color,
        shape: canvasElements.shape,
        x: canvasElements.x,
        y: canvasElements.y,
        w: canvasElements.w,
        h: canvasElements.h,
        rotation: canvasElements.rotation,
        z: canvasElements.z,
        votes: canvasElements.votes,
        createdAt: canvasElements.createdAt,
        authorName: user.name,
      })
      .from(canvasElements)
      .leftJoin(user, eq(canvasElements.userId, user.id))
      .where(eq(canvasElements.teamId, teamId))
      .orderBy(asc(canvasElements.z), asc(canvasElements.createdAt))
  }

  async seedDefaultFrames(teamId: number, userId: string) {
    await this.assertRetroAccess(teamId, userId)

    const existing = await this.db
      .select({ id: canvasElements.id })
      .from(canvasElements)
      .where(eq(canvasElements.teamId, teamId))
      .limit(1)

    if (existing.length) return { seeded: false }

    await this.db.insert(canvasElements).values(
      DEFAULT_FRAMES.map((f, i) => ({
        teamId,
        userId,
        type: f.type,
        content: f.content,
        color: f.color,
        x: f.x,
        y: f.y,
        w: f.w,
        h: f.h,
        z: i,
      }))
    )
    return { seeded: true }
  }

  async create(teamId: number, userId: string, input: CreateElementDto) {
    await this.assertRetroAccess(teamId, userId)

    const [maxZ] = await this.db
      .select({ value: sql<number>`coalesce(max(${canvasElements.z}), 0)` })
      .from(canvasElements)
      .where(eq(canvasElements.teamId, teamId))

    const [created] = await this.db
      .insert(canvasElements)
      .values({
        teamId,
        userId,
        type: input.type,
        content: input.content ?? '',
        color: input.color ?? 'yellow',
        shape: input.shape ?? null,
        x: Math.round(input.x),
        y: Math.round(input.y),
        w: Math.round(input.w ?? 192),
        h: Math.round(input.h ?? 120),
        rotation: Math.round(input.rotation ?? 0),
        z: (maxZ?.value ?? 0) + 1,
      })
      .returning()

    this.realtime.emitTeam(teamId, 'element:created', {
      element: created,
      actorId: userId,
    })
    this.realtime.emitActivity(
      teamId,
      userId,
      `added ${ELEMENT_LABELS[created.type] ?? 'an element'}`,
      'retro',
    )
    return created
  }

  async update(elementId: number, userId: string, input: UpdateElementDto) {
    const [element] = await this.db
      .select()
      .from(canvasElements)
      .where(eq(canvasElements.id, elementId))
    if (!element) throw new NotFoundException('Element not found')
    await this.assertRetroAccess(element.teamId, userId)

    const patch: Record<string, unknown> = { updatedAt: new Date() }
    if (input.content !== undefined) patch.content = input.content
    if (input.color !== undefined) patch.color = input.color
    if (input.x !== undefined) patch.x = Math.round(input.x)
    if (input.y !== undefined) patch.y = Math.round(input.y)
    if (input.w !== undefined) patch.w = Math.round(input.w)
    if (input.h !== undefined) patch.h = Math.round(input.h)
    if (input.rotation !== undefined) patch.rotation = Math.round(input.rotation)
    if (input.z !== undefined) patch.z = Math.round(input.z)

    const [updated] = await this.db
      .update(canvasElements)
      .set(patch)
      .where(eq(canvasElements.id, elementId))
      .returning()

    this.realtime.emitTeam(element.teamId, 'element:updated', {
      element: updated,
      actorId: userId,
    })
    return updated
  }

  async vote(elementId: number, userId: string) {
    const [element] = await this.db
      .select()
      .from(canvasElements)
      .where(eq(canvasElements.id, elementId))
    if (!element) throw new NotFoundException('Element not found')
    await this.assertRetroAccess(element.teamId, userId)

    const [updated] = await this.db
      .update(canvasElements)
      .set({ votes: sql`${canvasElements.votes} + 1`, updatedAt: new Date() })
      .where(eq(canvasElements.id, elementId))
      .returning()

    this.realtime.emitTeam(element.teamId, 'element:updated', {
      element: updated,
      actorId: userId,
    })
    this.realtime.emitActivity(element.teamId, userId, 'voted on an element', 'retro')
    return updated
  }

  async remove(elementId: number, userId: string) {
    const [element] = await this.db
      .select()
      .from(canvasElements)
      .where(eq(canvasElements.id, elementId))
    if (!element) throw new NotFoundException('Element not found')
    await this.assertRetroAccess(element.teamId, userId)
    if (element.userId !== userId) {
      throw new ForbiddenException('Only the author can delete this element')
    }
    await this.db.delete(canvasElements).where(eq(canvasElements.id, elementId))

    this.realtime.emitTeam(element.teamId, 'element:deleted', {
      id: elementId,
      actorId: userId,
    })
    this.realtime.emitActivity(element.teamId, userId, 'deleted an element', 'retro')
    return { ok: true }
  }
}
