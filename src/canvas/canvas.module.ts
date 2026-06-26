import { Module } from '@nestjs/common'
import { CanvasController } from './canvas.controller'
import { CanvasService } from './canvas.service'
import { TeamsModule } from '../teams/teams.module'

@Module({
  imports: [TeamsModule],
  controllers: [CanvasController],
  providers: [CanvasService],
})
export class CanvasModule {}
