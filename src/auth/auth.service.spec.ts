import { Test } from '@nestjs/testing'
import { ConflictException, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { AuthService } from './auth.service'
import { UsersService } from '../users/users.service'
import { OrganizationsService } from '../organizations/organizations.service'
import { DRIZZLE } from '../db/drizzle.module'

describe('AuthService', () => {
  let service: AuthService
  const users = {
    findByEmail: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
    toPublic: jest.fn((u) => u),
  }
  const jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt') }
  const config = { get: jest.fn().mockReturnValue('900') }
  const db = { insert: jest.fn(), delete: jest.fn(), select: jest.fn() }
  const organizations = { create: jest.fn() }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
        { provide: DRIZZLE, useValue: db },
        { provide: OrganizationsService, useValue: organizations },
      ],
    }).compile()
    service = moduleRef.get(AuthService)
    jest.clearAllMocks()
  })

  it('throws ConflictException when email already registered', async () => {
    users.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com' })
    await expect(
      service.register({ name: 'A', email: 'a@b.com', password: 'password123' })
    ).rejects.toBeInstanceOf(ConflictException)
  })

  it('throws UnauthorizedException for unknown login email', async () => {
    users.findByEmail.mockResolvedValue(null)
    await expect(
      service.login({ email: 'x@y.com', password: 'whatever' })
    ).rejects.toBeInstanceOf(UnauthorizedException)
  })
})
