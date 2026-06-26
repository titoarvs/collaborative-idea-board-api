import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { DRIZZLE, type DrizzleDB } from '../db/drizzle.module'
import { user } from '../db/schema'

export interface PublicUser {
  id: string
  name: string
  email: string
  image: string | null
  role: string
}

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findByEmail(email: string) {
    const [row] = await this.db
      .select()
      .from(user)
      .where(eq(user.email, email.toLowerCase()))
    return row ?? null
  }

  async findById(id: string) {
    const [row] = await this.db.select().from(user).where(eq(user.id, id))
    return row ?? null
  }

  async create(input: { name: string; email: string; passwordHash: string }) {
    const [row] = await this.db
      .insert(user)
      .values({
        id: randomUUID(),
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        emailVerified: false,
      })
      .returning()
    return row
  }

  toPublic(row: {
    id: string
    name: string
    email: string
    image: string | null
    role?: string
  }): PublicUser {
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      image: row.image,
      role: row.role ?? 'user',
    }
  }
}
