import { pgTable, text, timestamp, boolean, serial, integer } from 'drizzle-orm/pg-core'

// --- Auth tables -----------------------------------------------------------
// `user` retains the columns previously owned by better-auth so existing rows
// stay valid. `passwordHash` is added for NestJS-native credential auth.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  passwordHash: text('passwordHash'),
  // Platform-level role: 'system_admin' grants access to the admin console.
  role: text('role').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

export const refreshTokens = pgTable('refreshTokens', {
  id: serial('id').primaryKey(),
  userId: text('userId').notNull(),
  tokenHash: text('tokenHash').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// --- Tenancy / billing tables ---------------------------------------------

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('ownerId').notNull(),
  // 'free' | 'pro'. During a trial the plan is 'pro' with status 'trialing'.
  plan: text('plan').notNull().default('pro'),
  // 'trialing' | 'active' | 'past_due' | 'canceled' | 'expired'
  status: text('status').notNull().default('trialing'),
  trialEndsAt: timestamp('trialEndsAt'),
  currentPeriodEnd: timestamp('currentPeriodEnd'),
  cancelAtPeriodEnd: boolean('cancelAtPeriodEnd').notNull().default(false),
  billingProvider: text('billingProvider'),
  billingCustomerId: text('billingCustomerId'),
  billingSubscriptionId: text('billingSubscriptionId'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const organizationMembers = pgTable('organizationMembers', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull(),
  userId: text('userId').notNull(),
  // 'owner' | 'admin' | 'member'
  role: text('role').notNull().default('member'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

export const organizationInvites = pgTable('organizationInvites', {
  id: serial('id').primaryKey(),
  organizationId: integer('organizationId').notNull(),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  token: text('token').notNull().unique(),
  invitedBy: text('invitedBy'),
  acceptedAt: timestamp('acceptedAt'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
})

// Platform-wide billing configuration, managed by system admins. A single row
// (id = 1). Secret columns store AES-256-GCM ciphertext, never plaintext.
export const billingSettings = pgTable('billingSettings', {
  id: integer('id').primaryKey().default(1),
  // 'dev' | 'stripe' | 'paymongo' | 'none'
  activeProvider: text('activeProvider').notNull().default('dev'),
  stripeSecretKey: text('stripeSecretKey'),
  stripePricePro: text('stripePricePro'),
  stripeWebhookSecret: text('stripeWebhookSecret'),
  paymongoSecretKey: text('paymongoSecretKey'),
  paymongoProAmount: integer('paymongoProAmount'),
  paymongoWebhookSecret: text('paymongoWebhookSecret'),
  updatedBy: text('updatedBy'),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

// --- App tables ------------------------------------------------------------

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  // Nullable so pre-tenancy rows remain valid; new boards always set this.
  organizationId: integer('organizationId'),
  userId: text('userId').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  inviteCode: text('inviteCode').notNull().unique(),
  activeSessions: integer('activeSessions').notNull().default(0),
  maxSessions: integer('maxSessions').notNull().default(5),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const teamMembers = pgTable('teamMembers', {
  id: serial('id').primaryKey(),
  teamId: integer('teamId').notNull(),
  userId: text('userId').notNull(),
  role: text('role').notNull().default('member'),
  joinedAt: timestamp('joinedAt').notNull().defaultNow(),
})

export const ideas = pgTable('ideas', {
  id: serial('id').primaryKey(),
  teamId: integer('teamId').notNull(),
  userId: text('userId').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('backlog'),
  votes: integer('votes').notNull().default(0),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const retroCards = pgTable('retroCards', {
  id: serial('id').primaryKey(),
  teamId: integer('teamId').notNull(),
  userId: text('userId').notNull(),
  column: text('column').notNull().default('good'),
  content: text('content').notNull(),
  color: text('color').notNull().default('yellow'),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  votes: integer('votes').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const canvasElements = pgTable('canvasElements', {
  id: serial('id').primaryKey(),
  teamId: integer('teamId').notNull(),
  userId: text('userId').notNull(),
  type: text('type').notNull().default('sticky'),
  content: text('content').notNull().default(''),
  color: text('color').notNull().default('yellow'),
  shape: text('shape'),
  x: integer('x').notNull().default(0),
  y: integer('y').notNull().default(0),
  w: integer('w').notNull().default(192),
  h: integer('h').notNull().default(120),
  rotation: integer('rotation').notNull().default(0),
  z: integer('z').notNull().default(0),
  votes: integer('votes').notNull().default(0),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const comments = pgTable('comments', {
  id: serial('id').primaryKey(),
  ideaId: integer('ideaId').notNull(),
  userId: text('userId').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})
