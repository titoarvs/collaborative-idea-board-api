CREATE TABLE "billingSettings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"activeProvider" text DEFAULT 'dev' NOT NULL,
	"stripeSecretKey" text,
	"stripePricePro" text,
	"stripeWebhookSecret" text,
	"paymongoSecretKey" text,
	"paymongoProAmount" integer,
	"paymongoWebhookSecret" text,
	"updatedBy" text,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
