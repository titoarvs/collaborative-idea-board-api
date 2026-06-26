import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { AuthService, type IssuedTokens } from './auth.service'
import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { Public } from '../common/decorators/public.decorator'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService
  ) {}

  private setCookies(res: Response, tokens: IssuedTokens) {
    const secure = this.config.get('COOKIE_SECURE') === 'true'
    const common = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure,
      path: '/',
    }
    res.cookie('access_token', tokens.accessToken, {
      ...common,
      maxAge: tokens.accessMaxAge,
    })
    res.cookie('refresh_token', tokens.refreshToken, {
      ...common,
      maxAge: tokens.refreshMaxAge,
    })
  }

  private clearCookies(res: Response) {
    res.clearCookie('access_token', { path: '/' })
    res.clearCookie('refresh_token', { path: '/' })
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new account' })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens } = await this.auth.register(dto)
    this.setCookies(res, tokens)
    return { user }
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response
  ) {
    const { user, tokens } = await this.auth.login(dto)
    this.setCookies(res, tokens)
    return { user }
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate tokens using the refresh cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const raw = req.cookies?.refresh_token as string | undefined
    const { user, tokens } = await this.auth.refresh(raw)
    this.setCookies(res, tokens)
    return { user }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log out and revoke the refresh token' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    const raw = req.cookies?.refresh_token as string | undefined
    await this.auth.logout(raw)
    this.clearCookies(res)
    return { ok: true }
  }

  @Get('me')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  async me(@CurrentUser() user: AuthUser) {
    return { user: await this.auth.me(user.userId) }
  }
}
