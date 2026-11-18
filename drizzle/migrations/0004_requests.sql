-- Housing requests: people looking for a place, not just people offering one.
--
-- Listings also gain two hard requirements seekers ask for, so a request can
-- be matched against them: Anmeldung (city registration) and pets.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "anmeldung" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "pets_allowed" boolean NOT NULL DEFAULT false;
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "housing_requests" (
  "id" serial PRIMARY KEY NOT NULL,
  "seeker_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "city" text NOT NULL DEFAULT 'Berlin',
  "areas" text[] NOT NULL DEFAULT '{}'::text[],
  "check_in" integer NOT NULL,
  "check_out" integer NOT NULL,
  "dates_flexible" boolean NOT NULL DEFAULT false,
  "room_type" text NOT NULL,
  "guests" integer NOT NULL DEFAULT 1,
  "with_children" boolean NOT NULL DEFAULT false,
  "with_pets" boolean NOT NULL DEFAULT false,
  "max_budget_cents" integer,
  "budget_period" text,
  "needs_anmeldung" boolean NOT NULL DEFAULT false,
  "flinta_only" boolean NOT NULL DEFAULT false,
  "status" text NOT NULL DEFAULT 'open',
  "created_at" bigint NOT NULL,
  "updated_at" bigint NOT NULL,
  CONSTRAINT "ck_requests_dates" CHECK ("check_out" > "check_in"),
  CONSTRAINT "ck_requests_guests" CHECK ("guests" >= 1),
  CONSTRAINT "ck_requests_budget" CHECK (
    ("max_budget_cents" IS NULL) = ("budget_period" IS NULL)
    AND ("max_budget_cents" IS NULL OR "max_budget_cents" >= 0)
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requests_seeker" ON "housing_requests" ("seeker_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_requests_open" ON "housing_requests" ("status", "check_out");
