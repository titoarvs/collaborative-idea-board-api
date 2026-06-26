import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { teams, teamMembers, user } from '../db/schema'

@Injectable()
export class TeamsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private generateInviteCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase()
  }

  async assertMember(teamId: number, userId: string) {
    const [member] = await this.db
      .select()
      .from(teamMembers)
      .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)))
    if (!member) throw new ForbiddenException('Not a member of this team')
    return member
  }

  async create(userId: string, name: string, description?: string) {
    const [team] = await this.db
      .insert(teams)
      .values({
        userId,
        name,
        description,
        inviteCode: this.generateInviteCode(),
      })
      .returning()

    await this.db.insert(teamMembers).values({
      teamId: team.id,
      userId,
      role: 'admin',
    })

    return team
  }

  /** Teams the user owns or is a member of, de-duplicated. */
  async listMine(userId: string) {
    const owned = await this.db
      .select()
      .from(teams)
      .where(eq(teams.userId, userId))

    const memberRows = await this.db
      .select({ team: teams })
      .from(teamMembers)
      .leftJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(eq(teamMembers.userId, userId))

    const memberTeams = memberRows
      .map(r => r.team)
      .filter((t): t is NonNullable<typeof t> => Boolean(t))

    const byId = new Map<number, (typeof owned)[number]>()
    for (const t of [...owned, ...memberTeams]) byId.set(t.id, t)
    return Array.from(byId.values())
  }

  async getOne(teamId: number, userId: string) {
    await this.assertMember(teamId, userId)
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId))
    if (!team) throw new NotFoundException('Team not found')
    return team
  }

  async getMembers(teamId: number, userId: string) {
    await this.assertMember(teamId, userId)
    return this.db
      .select({
        userId: teamMembers.userId,
        name: user.name,
        role: teamMembers.role,
      })
      .from(teamMembers)
      .leftJoin(user, eq(teamMembers.userId, user.id))
      .where(eq(teamMembers.teamId, teamId))
  }

  async joinByCode(userId: string, inviteCode: string) {
    const [team] = await this.db
      .select()
      .from(teams)
      .where(eq(teams.inviteCode, inviteCode))
    if (!team) throw new NotFoundException('Invalid invite code')

    const [existing] = await this.db
      .select()
      .from(teamMembers)
      .where(
        and(eq(teamMembers.teamId, team.id), eq(teamMembers.userId, userId))
      )

    if (!existing) {
      await this.db.insert(teamMembers).values({
        teamId: team.id,
        userId,
        role: 'member',
      })
    }
    return team
  }

  async remove(teamId: number, userId: string) {
    const [team] = await this.db.select().from(teams).where(eq(teams.id, teamId))
    if (!team) throw new NotFoundException('Team not found')
    if (team.userId !== userId) {
      throw new ForbiddenException('Only the owner can delete this team')
    }
    await this.db.delete(teamMembers).where(eq(teamMembers.teamId, teamId))
    await this.db.delete(teams).where(eq(teams.id, teamId))
    return { ok: true }
  }
}
