import { Module } from '@nestjs/common'
import { CanvasController } from './canvas.controller'
import { CanvasService } from './canvas.service'
import { TeamsModule } from '../teams/teams.module'
import { OrganizationsModule } from '../organizations/organizations.module'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [TeamsModule, OrganizationsModule, RealtimeModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
