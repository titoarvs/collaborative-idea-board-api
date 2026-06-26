import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Strip `sslmode`/`channel_binding` from the URL and configure TLS explicitly,
// mirroring src/db/drizzle.module.ts. This also avoids the pg-connection-string
// deprecation warning about `sslmode` aliases during drizzle-kit commands.
const url = (process.env.DATABASE_URL ?? '')
  .replace(/([?&])sslmode=[^&]*/, '$1')
  .replace(/([?&])channel_binding=[^&]*/, '$1')
  .replace(/[?&]+$/, '')
  .replace(/([?&])&+/g, '$1')

const useSsl = process.env.DATABASE_SSL === 'true'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url,
    ssl: useSsl ? { rejectUnauthorized: true } : false,
  },
})
