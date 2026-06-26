import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { JwtService } from '@nestjs/jwt'
import * as bcrypt from 'bcryptjs'
import { createHash, randomBytes } from 'crypto'
import { and, eq, lt } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { refreshTokens } from '../db/schema'
import { UsersService, type PublicUser } from '../users/users.service'
import type { RegisterDto } from './dto/register.dto'
import type { LoginDto } from './dto/login.dto'

export interface IssuedTokens {
  accessToken: string
  refreshToken: string
  accessMaxAge: number
  refreshMaxAge: number
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService
  ) {}

  private get accessTtl() {
    return Number(this.config.get('JWT_ACCESS_TTL') ?? 900)
  }
  private get refreshTtl() {
    return Number(this.config.get('JWT_REFRESH_TTL') ?? 604800)
  }

  async register(dto: RegisterDto): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const existing = await this.users.findByEmail(dto.email)
    if (existing) throw new ConflictException('Email already registered')

    const passwordHash = await bcrypt.hash(dto.password, 10)
    const created = await this.users.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
    })

    const tokens = await this.issueTokens(created.id, created.email)
    return { user: this.users.toPublic(created), tokens }
  }

  async login(dto: LoginDto): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    const row = await this.users.findByEmail(dto.email)
    if (!row || !row.passwordHash) {
      throw new UnauthorizedException('Invalid email or password')
    }
    const ok = await bcrypt.compare(dto.password, row.passwordHash)
    if (!ok) throw new UnauthorizedException('Invalid email or password')

    const tokens = await this.issueTokens(row.id, row.email)
    return { user: this.users.toPublic(row), tokens }
  }

  async issueTokens(userId: string, email: string): Promise<IssuedTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
        expiresIn: this.accessTtl,
      }
    )

    const refreshToken = randomBytes(48).toString('hex')
    const expiresAt = new Date(Date.now() + this.refreshTtl * 1000)
    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash: hashToken(refreshToken),
      expiresAt,
    })

    return {
      accessToken,
      refreshToken,
      accessMaxAge: this.accessTtl * 1000,
      refreshMaxAge: this.refreshTtl * 1000,
    }
  }

  async refresh(rawToken: string | undefined): Promise<{ user: PublicUser; tokens: IssuedTokens }> {
    if (!rawToken) throw new UnauthorizedException('Missing refresh token')
    const tokenHash = hashToken(rawToken)

    const [row] = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))

    if (!row || row.expiresAt.getTime() < Date.now()) {
      if (row) {
        await this.db.delete(refreshTokens).where(eq(refreshTokens.id, row.id))
      }
      throw new UnauthorizedException('Invalid refresh token')
    }

    // rotate: delete old, issue fresh
    await this.db.delete(refreshTokens).where(eq(refreshTokens.id, row.id))

    const dbUser = await this.users.findById(row.userId)
    if (!dbUser) throw new UnauthorizedException('User no longer exists')

    const tokens = await this.issueTokens(dbUser.id, dbUser.email)
    return { user: this.users.toPublic(dbUser), tokens }
  }

  async logout(rawToken: string | undefined) {
    if (!rawToken) return
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashToken(rawToken)))
  }

  async me(userId: string): Promise<PublicUser> {
    const dbUser = await this.users.findById(userId)
    if (!dbUser) throw new UnauthorizedException()
    return this.users.toPublic(dbUser)
  }

  /** Best-effort cleanup of expired refresh tokens for a user. */
  async pruneExpired(userId: string) {
    await this.db
      .delete(refreshTokens)
      .where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, new Date())))
  }
}
