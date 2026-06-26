import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { DrizzleModule } from './db/drizzle.module'
import { AuthModule } from './auth/auth.module'
import { JwtAuthGuard } from './auth/jwt-auth.guard'
import { UsersModule } from './users/users.module'
import { TeamsModule } from './teams/teams.module'
import { IdeasModule } from './ideas/ideas.module'
import { CanvasModule } from './canvas/canvas.module'
import { OrganizationsModule } from './organizations/organizations.module'
import { BillingModule } from './billing/billing.module'
import { AdminModule } from './admin/admin.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    UsersModule,
    AuthModule,
    OrganizationsModule,
    TeamsModule,
    IdeasModule,
    CanvasModule,
    BillingModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
