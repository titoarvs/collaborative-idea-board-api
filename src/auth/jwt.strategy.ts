import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PassportStrategy } from '@nestjs/passport'
import { Strategy } from 'passport-jwt'
import type { Request } from 'express'
import type { AuthUser } from '../common/decorators/current-user.decorator'

function cookieExtractor(req: Request): string | null {
  if (req?.cookies && typeof req.cookies.access_token === 'string') {
    return req.cookies.access_token
  }
  return null
}

interface JwtPayload {
  sub: string
  email: string
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: cookieExtractor,
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_ACCESS_SECRET') ?? 'dev-secret',
    })
  }

  validate(payload: JwtPayload): AuthUser {
    return { userId: payload.sub, email: payload.email }
  }
}
