import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

export interface AuthUser {
  userId: string
  email: string
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const request = ctx.switchToHttp().getRequest()
    const user = request.user as AuthUser
    return data ? user?.[data] : user
  }
)
