import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { TeamsService } from './teams.service'
import { CreateTeamDto } from './dto/create-team.dto'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

/** Org-scoped board (team) endpoints: `/organizations/:orgId/teams`. */
@ApiTags('teams')
@Controller('organizations/:orgId/teams')
export class OrgTeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  list(
    @CurrentUser() u: AuthUser,
    @Param('orgId', ParseIntPipe) orgId: number,
  ) {
    return this.teams.listByOrg(orgId, u.userId)
  }

  @Post()
  create(
    @CurrentUser() u: AuthUser,
    @Param('orgId', ParseIntPipe) orgId: number,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teams.createInOrg(orgId, u.userId, dto.name, dto.description)
  }
}
