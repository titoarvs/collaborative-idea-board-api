CREATE TABLE "refreshTokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" text NOT NULL,
	"tokenHash" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "passwordHash" text;