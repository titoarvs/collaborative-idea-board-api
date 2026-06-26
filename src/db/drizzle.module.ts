import { Global, Module } from '@nestjs/common'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema'

export const DRIZZLE = Symbol('DRIZZLE')

export type DrizzleDB = NodePgDatabase<typeof schema>

function createPool() {
  // Strip `sslmode`/`channel_binding` from the URL and configure TLS explicitly,
  // mirroring the previous Next.js setup to avoid pg deprecation warnings.
  const connectionString = (process.env.DATABASE_URL ?? '')
    .replace(/([?&])sslmode=[^&]*/, '$1')
    .replace(/([?&])channel_binding=[^&]*/, '$1')
    .replace(/[?&]+$/, '')
    .replace(/([?&])&+/g, '$1')

  const useSsl = process.env.DATABASE_SSL === 'true'

  return new Pool({
    connectionString,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
  })
}

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: (): DrizzleDB => drizzle(createPool(), { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
