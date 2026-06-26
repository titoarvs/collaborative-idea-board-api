import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CanvasService } from './canvas.service'
import { CreateElementDto } from './dto/create-element.dto'
import { UpdateElementDto } from './dto/update-element.dto'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('canvas')
@Controller()
export class CanvasController {
  constructor(private readonly canvas: CanvasService) {}

  @Get('teams/:teamId/canvas/elements')
  list(
    @CurrentUser() u: AuthUser,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    return this.canvas.listElements(teamId, u.userId)
  }

  @Post('teams/:teamId/canvas/seed')
  seed(
    @CurrentUser() u: AuthUser,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    return this.canvas.seedDefaultFrames(teamId, u.userId)
  }

  @Post('teams/:teamId/canvas/elements')
  create(
    @CurrentUser() u: AuthUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateElementDto
  ) {
    return this.canvas.create(teamId, u.userId, dto)
  }

  @Patch('canvas/elements/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateElementDto
  ) {
    return this.canvas.update(id, u.userId, dto)
  }

  @Post('canvas/elements/:id/vote')
  vote(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.canvas.vote(id, u.userId)
  }

  @Delete('canvas/elements/:id')
  remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.canvas.remove(id, u.userId)
  }
}
