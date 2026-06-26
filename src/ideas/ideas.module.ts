import { Module } from '@nestjs/common'
import { IdeasController } from './ideas.controller'
import { IdeasService } from './ideas.service'
import { TeamsModule } from '../teams/teams.module'
import { RealtimeModule } from '../realtime/realtime.module'

@Module({
  imports: [TeamsModule, RealtimeModule],
  controllers: [IdeasController],
  providers: [IdeasService],
})
export class IdeasModule {}
