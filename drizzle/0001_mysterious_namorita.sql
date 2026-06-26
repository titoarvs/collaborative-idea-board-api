CREATE TABLE "retroCards" (
	"id" serial PRIMARY KEY NOT NULL,
	"teamId" integer NOT NULL,
	"userId" text NOT NULL,
	"column" text DEFAULT 'went-well' NOT NULL,
	"content" text NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ideas" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;