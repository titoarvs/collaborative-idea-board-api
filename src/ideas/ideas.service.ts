import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, asc, eq, sql } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { ideas, comments, user } from '../db/schema'
import { TeamsService } from '../teams/teams.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'

@Injectable()
export class IdeasService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly teams: TeamsService,
    private readonly realtime: RealtimeGateway
  ) {}

  private async getIdeaOrThrow(ideaId: number) {
    const [idea] = await this.db.select().from(ideas).where(eq(ideas.id, ideaId))
    if (!idea) throw new NotFoundException('Idea not found')
    return idea
  }

  async listByTeam(teamId: number, userId: string) {
    await this.teams.assertMember(teamId, userId)
    return this.db
      .select()
      .from(ideas)
      .where(eq(ideas.teamId, teamId))
      .orderBy(asc(ideas.status), asc(ideas.position), asc(ideas.id))
  }

  async create(teamId: number, userId: string, title: string, description?: string) {
    await this.teams.assertMember(teamId, userId)

    const [{ nextPosition }] = await this.db
      .select({
        nextPosition: sql<number>`coalesce(max(${ideas.position}), -1) + 1`,
      })
      .from(ideas)
      .where(and(eq(ideas.teamId, teamId), eq(ideas.status, 'backlog')))

    const [created] = await this.db
      .insert(ideas)
      .values({
        teamId,
        userId,
        title,
        description,
        status: 'backlog',
        position: nextPosition,
      })
      .returning()

    this.realtime.emitTeam(teamId, 'idea:created', {
      idea: created,
      actorId: userId,
    })
    this.realtime.emitActivity(teamId, userId, `added "${created.title}"`, 'kanban')
    return created
  }

  async move(ideaId: number, userId: string, status: string, position: number) {
    const idea = await this.getIdeaOrThrow(ideaId)
    await this.teams.assertMember(idea.teamId, userId)
    const [updated] = await this.db
      .update(ideas)
      .set({ status, position, updatedAt: new Date() })
      .where(eq(ideas.id, ideaId))
      .returning()

    this.realtime.emitTeam(idea.teamId, 'idea:updated', {
      idea: updated,
      actorId: userId,
    })
    if (idea.status !== status) {
      this.realtime.emitActivity(
        idea.teamId,
        userId,
        `moved "${updated.title}" to ${status}`,
        'kanban',
      )
    }
    return updated
  }

  async updateStatus(ideaId: number, userId: string, status: string) {
    const idea = await this.getIdeaOrThrow(ideaId)
    await this.teams.assertMember(idea.teamId, userId)
    const [updated] = await this.db
      .update(ideas)
      .set({ status, updatedAt: new Date() })
      .where(eq(ideas.id, ideaId))
      .returning()

    this.realtime.emitTeam(idea.teamId, 'idea:updated', {
      idea: updated,
      actorId: userId,
    })
    this.realtime.emitActivity(
      idea.teamId,
      userId,
      `moved "${updated.title}" to ${status}`,
      'kanban',
    )
    return updated
  }

  async vote(ideaId: number, userId: string) {
    const idea = await this.getIdeaOrThrow(ideaId)
    await this.teams.assertMember(idea.teamId, userId)
    const [updated] = await this.db
      .update(ideas)
      .set({ votes: (idea.votes || 0) + 1, updatedAt: new Date() })
      .where(eq(ideas.id, ideaId))
      .returning()

    this.realtime.emitTeam(idea.teamId, 'idea:updated', {
      idea: updated,
      actorId: userId,
    })
    this.realtime.emitActivity(idea.teamId, userId, `voted on "${updated.title}"`, 'kanban')
    return updated
  }

  async remove(ideaId: number, userId: string) {
    const idea = await this.getIdeaOrThrow(ideaId)
    if (idea.userId !== userId) {
      throw new ForbiddenException('Only the author can delete this idea')
    }
    await this.teams.assertMember(idea.teamId, userId)
    await this.db.delete(comments).where(eq(comments.ideaId, ideaId))
    await this.db.delete(ideas).where(eq(ideas.id, ideaId))

    this.realtime.emitTeam(idea.teamId, 'idea:deleted', {
      id: ideaId,
      actorId: userId,
    })
    this.realtime.emitActivity(idea.teamId, userId, `deleted "${idea.title}"`, 'kanban')
    return { ok: true }
  }

  // --- comments ------------------------------------------------------------

  async listComments(ideaId: number, userId: string) {
    const idea = await this.getIdeaOrThrow(ideaId)
    await this.teams.assertMember(idea.teamId, userId)
    return this.db
      .select({
        id: comments.id,
        ideaId: comments.ideaId,
        userId: comments.userId,
        content: comments.content,
        createdAt: comments.createdAt,
        authorName: user.name,
      })
      .from(comments)
      .leftJoin(user, eq(comments.userId, user.id))
      .where(eq(comments.ideaId, ideaId))
      .orderBy(asc(comments.createdAt))
  }

  async addComment(ideaId: number, userId: string, content: string) {
    const idea = await this.getIdeaOrThrow(ideaId)
    await this.teams.assertMember(idea.teamId, userId)
    const [created] = await this.db
      .insert(comments)
      .values({ ideaId, userId, content })
      .returning()

    this.realtime.emitTeam(idea.teamId, 'comment:created', {
      comment: created,
      ideaId,
      actorId: userId,
    })
    this.realtime.emitActivity(idea.teamId, userId, `commented on "${idea.title}"`, 'kanban')
    return created
  }

  async deleteComment(commentId: number, userId: string) {
    const [comment] = await this.db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
    if (!comment || comment.userId !== userId) {
      throw new ForbiddenException('Cannot delete this comment')
    }
    await this.db.delete(comments).where(eq(comments.id, commentId))

    const [idea] = await this.db
      .select({ teamId: ideas.teamId })
      .from(ideas)
      .where(eq(ideas.id, comment.ideaId))
    if (idea) {
      this.realtime.emitTeam(idea.teamId, 'comment:deleted', {
        id: commentId,
        ideaId: comment.ideaId,
        actorId: userId,
      })
    }
    return { ok: true }
  }
}
