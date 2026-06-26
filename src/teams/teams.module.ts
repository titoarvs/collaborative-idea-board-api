import { Module } from '@nestjs/common'
import { TeamsController } from './teams.controller'
import { OrgTeamsController } from './org-teams.controller'
import { TeamsService } from './teams.service'
import { OrganizationsModule } from '../organizations/organizations.module'

@Module({
  imports: [OrganizationsModule],
  controllers: [TeamsController, OrgTeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
