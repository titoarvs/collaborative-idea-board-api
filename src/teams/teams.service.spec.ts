import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { TeamsService } from './teams.service'
import { DRIZZLE } from '../db/drizzle.module'
import { OrganizationsService } from '../organizations/organizations.service'

describe('TeamsService', () => {
  let service: TeamsService
  const where = jest.fn()
  const db = {
    select: jest.fn(() => ({ from: jest.fn(() => ({ where })) })),
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: DRIZZLE, useValue: db },
        { provide: OrganizationsService, useValue: {} },
      ],
    }).compile()
    service = moduleRef.get(TeamsService)
    jest.clearAllMocks()
  })

  it('assertMember throws when the user is not a member', async () => {
    where.mockResolvedValue([])
    await expect(service.assertMember(1, 'user-1')).rejects.toBeInstanceOf(
      ForbiddenException
    )
  })

  it('assertMember resolves when membership exists', async () => {
    where.mockResolvedValue([
      { id: 1, teamId: 1, userId: 'user-1', role: 'member' },
    ])
    await expect(service.assertMember(1, 'user-1')).resolves.toBeTruthy()
  })
})
