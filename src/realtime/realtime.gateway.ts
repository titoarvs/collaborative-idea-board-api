import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import {
  type OnGatewayConnection,
  type OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Server, Socket } from 'socket.io'
import { TeamsService } from '../teams/teams.service'

type Board = 'retro' | 'kanban'

interface SocketUser {
  userId: string
  email: string
  name: string
}

interface PresenceUser {
  userId: string
  name: string
  board: Board | null
}

export interface ActivityEntry {
  id: string
  teamId: number
  userId: string
  name: string
  action: string
  board: Board | null
  at: number
}

interface JoinPayload {
  teamId: number
  board: Board
  name?: string
}

interface CursorPayload {
  teamId: number
  board: Board
  x: number
  y: number
}

interface SelectionPayload {
  teamId: number
  board: Board
  elementId: number | null
  editing?: boolean
}

const room = (teamId: number) => `team:${teamId}`

function parseCookie(header: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    const key = part.slice(0, idx).trim()
    if (!key) continue
    out[key] = decodeURIComponent(part.slice(idx + 1).trim())
  }
  return out
}

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server!: Server
  private readonly logger = new Logger(RealtimeGateway.name)

  // teamId -> (socketId -> presence)
  private readonly presence = new Map<number, Map<string, PresenceUser>>()

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly teams: TeamsService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie ?? '')
      const token = cookies['access_token']
      if (!token) throw new Error('Missing access token')
      const payload = await this.jwt.verifyAsync<{
        sub: string
        email: string
      }>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-secret',
      })
      const user: SocketUser = {
        userId: payload.sub,
        email: payload.email,
        name: '',
      }
      socket.data.user = user
    } catch {
      socket.disconnect(true)
    }
  }

  handleDisconnect(socket: Socket) {
    const teamId = socket.data.teamId as number | undefined
    const user = socket.data.user as SocketUser | undefined
    if (teamId == null || !user) return

    const members = this.presence.get(teamId)
    members?.delete(socket.id)
    if (members && members.size === 0) this.presence.delete(teamId)

    this.broadcastPresence(teamId)
    this.server.to(room(teamId)).emit('presence:left', {
      socketId: socket.id,
      userId: user.userId,
    })
    // Only log a "left" activity when this was the user's last socket.
    if (!this.isUserOnline(teamId, user.userId)) {
      this.pushActivity(teamId, user.userId, user.name, 'left the board', null)
    }
  }

  @SubscribeMessage('board:join')
  async onJoin(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinPayload,
  ) {
    const user = socket.data.user as SocketUser | undefined
    if (!user) return { ok: false }

    const teamId = Number(payload.teamId)
    try {
      await this.teams.assertMember(teamId, user.userId)
    } catch {
      return { ok: false }
    }

    user.name = payload.name?.trim() || user.email
    socket.data.teamId = teamId
    await socket.join(room(teamId))

    const alreadyOnline = this.isUserOnline(teamId, user.userId)

    let members = this.presence.get(teamId)
    if (!members) {
      members = new Map()
      this.presence.set(teamId, members)
    }
    members.set(socket.id, {
      userId: user.userId,
      name: user.name,
      board: payload.board,
    })

    this.broadcastPresence(teamId)
    if (!alreadyOnline) {
      this.pushActivity(
        teamId,
        user.userId,
        user.name,
        'joined the board',
        payload.board,
      )
    }
    return { ok: true }
  }

  @SubscribeMessage('cursor:move')
  onCursor(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: CursorPayload,
  ) {
    const user = socket.data.user as SocketUser | undefined
    const teamId = socket.data.teamId as number | undefined
    if (!user || teamId == null || Number(payload.teamId) !== teamId) return
    socket.to(room(teamId)).emit('cursor:move', {
      socketId: socket.id,
      userId: user.userId,
      name: user.name,
      board: payload.board,
      x: payload.x,
      y: payload.y,
    })
  }

  @SubscribeMessage('element:select')
  onSelect(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SelectionPayload,
  ) {
    const user = socket.data.user as SocketUser | undefined
    const teamId = socket.data.teamId as number | undefined
    if (!user || teamId == null || Number(payload.teamId) !== teamId) return
    socket.to(room(teamId)).emit('element:select', {
      socketId: socket.id,
      userId: user.userId,
      name: user.name,
      board: payload.board,
      elementId: payload.elementId,
      editing: payload.editing ?? false,
    })
  }

  // --- public API used by services ------------------------------------------

  /** Broadcast a sync event to every member of a team room. */
  emitTeam(teamId: number, event: string, payload: Record<string, unknown>) {
    this.server.to(room(teamId)).emit(event, payload)
  }

  /** Build and broadcast an activity-feed entry, resolving the actor's name. */
  emitActivity(
    teamId: number,
    userId: string,
    action: string,
    board: Board | null = null,
  ) {
    const name = this.resolveName(teamId, userId)
    this.pushActivity(teamId, userId, name, action, board)
  }

  // --- helpers --------------------------------------------------------------

  private pushActivity(
    teamId: number,
    userId: string,
    name: string,
    action: string,
    board: Board | null,
  ) {
    const entry: ActivityEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      teamId,
      userId,
      name: name || 'Someone',
      action,
      board,
      at: Date.now(),
    }
    this.server.to(room(teamId)).emit('activity:new', entry)
  }

  private broadcastPresence(teamId: number) {
    const members = this.presence.get(teamId)
    const byUser = new Map<string, PresenceUser>()
    if (members) {
      for (const p of members.values()) {
        // Last writer wins; collapses multiple tabs into one presence entry.
        byUser.set(p.userId, p)
      }
    }
    this.server.to(room(teamId)).emit('presence:state', {
      users: Array.from(byUser.values()),
    })
  }

  private isUserOnline(teamId: number, userId: string) {
    const members = this.presence.get(teamId)
    if (!members) return false
    for (const p of members.values()) if (p.userId === userId) return true
    return false
  }

  private resolveName(teamId: number, userId: string) {
    const members = this.presence.get(teamId)
    if (members) {
      for (const p of members.values()) {
        if (p.userId === userId) return p.name
      }
    }
    return 'Someone'
  }
}
