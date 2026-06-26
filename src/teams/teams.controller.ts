import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TeamsService } from './teams.service'
import { CreateTeamDto } from './dto/create-team.dto'
import { JoinTeamDto } from './dto/join-team.dto'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('teams')
@Controller('teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  listMine(@CurrentUser() u: AuthUser) {
    return this.teams.listMine(u.userId)
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateTeamDto) {
    return this.teams.create(u.userId, dto.name, dto.description)
  }

  @Post('join')
  join(@CurrentUser() u: AuthUser, @Body() dto: JoinTeamDto) {
    return this.teams.joinByCode(u.userId, dto.inviteCode)
  }

  @Get(':id')
  getOne(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.teams.getOne(id, u.userId)
  }

  @Get(':id/members')
  members(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.teams.getMembers(id, u.userId)
  }

  @Delete(':id')
  remove(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number
  ) {
    return this.teams.remove(id, u.userId)
  }
}
