ALTER TABLE "retroCards" ALTER COLUMN "column" SET DEFAULT 'good';--> statement-breakpoint
ALTER TABLE "retroCards" ADD COLUMN "color" text DEFAULT 'yellow' NOT NULL;--> statement-breakpoint
ALTER TABLE "retroCards" ADD COLUMN "x" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "retroCards" ADD COLUMN "y" integer DEFAULT 0 NOT NULL;