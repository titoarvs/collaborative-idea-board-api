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
import { IdeasService } from './ideas.service'
import { CreateIdeaDto } from './dto/create-idea.dto'
import { MoveIdeaDto } from './dto/move-idea.dto'
import { UpdateStatusDto } from './dto/update-status.dto'
import { CreateCommentDto } from './dto/create-comment.dto'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('ideas')
@Controller()
export class IdeasController {
  constructor(private readonly ideas: IdeasService) {}

  @Get('teams/:teamId/ideas')
  list(
    @CurrentUser() u: AuthUser,
    @Param('teamId', ParseIntPipe) teamId: number
  ) {
    return this.ideas.listByTeam(teamId, u.userId)
  }

  @Post('teams/:teamId/ideas')
  create(
    @CurrentUser() u: AuthUser,
    @Param('teamId', ParseIntPipe) teamId: number,
    @Body() dto: CreateIdeaDto
  ) {
    return this.ideas.create(teamId, u.userId, dto.title, dto.description)
  }

  @Patch('ideas/:id/move')
  move(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MoveIdeaDto
  ) {
    return this.ideas.move(id, u.userId, dto.status, dto.position)
  }

  @Patch('ideas/:id/status')
  status(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateStatusDto
  ) {
    return this.ideas.updateStatus(id, u.userId, dto.status)
  }

  @Post('ideas/:id/vote')
  vote(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.ideas.vote(id, u.userId)
  }

  @Delete('ideas/:id')
  remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.ideas.remove(id, u.userId)
  }

  @Get('ideas/:id/comments')
  comments(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.ideas.listComments(id, u.userId)
  }

  @Post('ideas/:id/comments')
  addComment(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto
  ) {
    return this.ideas.addComment(id, u.userId, dto.content)
  }

  @Delete('comments/:id')
  deleteComment(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.ideas.deleteComment(id, u.userId)
  }
}
