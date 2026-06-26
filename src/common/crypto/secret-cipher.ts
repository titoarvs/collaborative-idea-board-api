import { Injectable, InternalServerErrorException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

/**
 * Symmetric encryption for secrets at rest (billing provider API keys).
 *
 * The 32-byte key is derived (SHA-256) from `BILLING_ENCRYPTION_KEY`, so the
 * env value can be any sufficiently random string. Ciphertext is serialized as
 * `v1:<iv>:<tag>:<data>` (all base64) to allow future format changes.
 */
@Injectable()
export class SecretCipher {
  constructor(private readonly config: ConfigService) {}

  private key(): Buffer {
    const secret = this.config.get<string>('BILLING_ENCRYPTION_KEY')
    if (!secret) {
      throw new InternalServerErrorException(
        'BILLING_ENCRYPTION_KEY is not set; cannot store billing secrets.',
      )
    }
    return createHash('sha256').update(secret).digest()
  }

  /** True when an encryption key is configured. */
  isConfigured(): boolean {
    return Boolean(this.config.get<string>('BILLING_ENCRYPTION_KEY'))
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES)
    const cipher = createCipheriv(ALGO, this.key(), iv)
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return [
      'v1',
      iv.toString('base64'),
      tag.toString('base64'),
      enc.toString('base64'),
    ].join(':')
  }

  /** Returns the plaintext, or null if the input is empty/undefined. */
  decrypt(payload: string | null | undefined): string | null {
    if (!payload) return null
    const parts = payload.split(':')
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new InternalServerErrorException('Malformed encrypted secret')
    }
    const [, iv, tag, data] = parts
    const decipher = createDecipheriv(ALGO, this.key(), Buffer.from(iv, 'base64'))
    decipher.setAuthTag(Buffer.from(tag, 'base64'))
    const dec = Buffer.concat([
      decipher.update(Buffer.from(data, 'base64')),
      decipher.final(),
    ])
    return dec.toString('utf8')
  }
}
