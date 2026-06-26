import { Module } from '@nestjs/common'
import { IdeasController } from './ideas.controller'
import { IdeasService } from './ideas.service'
import { TeamsModule } from '../teams/teams.module'

@Module({
  imports: [TeamsModule],
  controllers: [IdeasController],
  providers: [IdeasService],
})
export class IdeasModule {}
