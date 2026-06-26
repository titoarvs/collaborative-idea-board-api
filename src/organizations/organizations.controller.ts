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
import { OrganizationsService } from './organizations.service'
import { CreateOrganizationDto } from './dto/create-organization.dto'
import { UpdateOrganizationDto } from './dto/update-organization.dto'
import { InviteMemberDto } from './dto/invite-member.dto'
import { UpdateRoleDto } from './dto/update-role.dto'
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator'

@ApiTags('organizations')
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.orgs.listMine(u.userId)
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateOrganizationDto) {
    return this.orgs.create(u.userId, dto.name)
  }

  @Get(':id')
  getOne(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orgs.getOne(id, u.userId)
  }

  @Patch(':id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgs.update(id, u.userId, dto.name)
  }

  @Get(':id/members')
  members(@CurrentUser() u: AuthUser, @Param('id', ParseIntPipe) id: number) {
    return this.orgs.getMembers(id, u.userId)
  }

  @Post(':id/invites')
  invite(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgs.invite(id, u.userId, dto.email, dto.role)
  }

  @Patch(':id/members/:userId/role')
  updateRole(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId') userId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.orgs.updateMemberRole(id, u.userId, userId, dto.role)
  }

  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
    @Param('userId') userId: string,
  ) {
    return this.orgs.removeMember(id, u.userId, userId)
  }

  @Get(':id/subscription')
  subscription(
    @CurrentUser() u: AuthUser,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.orgs.getSubscription(id, u.userId)
  }
}
