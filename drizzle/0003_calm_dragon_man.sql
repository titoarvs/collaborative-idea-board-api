CREATE TABLE "canvasElements" (
	"id" serial PRIMARY KEY NOT NULL,
	"teamId" integer NOT NULL,
	"userId" text NOT NULL,
	"type" text DEFAULT 'sticky' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"color" text DEFAULT 'yellow' NOT NULL,
	"shape" text,
	"x" integer DEFAULT 0 NOT NULL,
	"y" integer DEFAULT 0 NOT NULL,
	"w" integer DEFAULT 192 NOT NULL,
	"h" integer DEFAULT 120 NOT NULL,
	"rotation" integer DEFAULT 0 NOT NULL,
	"z" integer DEFAULT 0 NOT NULL,
	"votes" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
