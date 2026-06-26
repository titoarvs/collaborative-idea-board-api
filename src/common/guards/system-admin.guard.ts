import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.module'
import { user } from '../../db/schema'
import type { AuthUser } from '../decorators/current-user.decorator'

/**
 * Allows the request only when the authenticated user has the platform
 * `system_admin` role, or their email is listed in `SYSTEM_ADMIN_EMAILS`
 * (a convenience for bootstrapping the first admin without DB edits).
 */
@Injectable()
export class SystemAdminGuard implements CanActivate {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>()
    const authUser = req.user
    if (!authUser) throw new ForbiddenException('Not authenticated')

    const allowlist = (this.config.get<string>('SYSTEM_ADMIN_EMAILS') ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
    if (authUser.email && allowlist.includes(authUser.email.toLowerCase())) {
      return true
    }

    const [row] = await this.db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, authUser.userId))
    if (row?.role === 'system_admin') return true

    throw new ForbiddenException('Requires system administrator role')
  }
}
