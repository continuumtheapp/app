-- Who stayed where (18-19 Nov 2026): marking a place taken records the stay,
-- so the host and guest can review each other afterwards. Written reviews
-- only, no star ratings: with so few stays per person a number says little.

CREATE TABLE IF NOT EXISTS "stays" (
  "id" serial PRIMARY KEY,
  -- Kept if the place is later deleted: the reviews are about people.
  "listing_id" integer REFERENCES "listings"("id") ON DELETE SET NULL,
  "listing_title" text NOT NULL,
  "host_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  -- A member, or nobody: someone outside SimbaCasa, or the host didn't say.
  "guest_id" text REFERENCES "users"("id") ON DELETE SET NULL,
  "guest_outside" boolean NOT NULL DEFAULT false,
  -- The last night, as a day number. The bot asks for reviews after it.
  "ends_on" integer,
  "review_requested_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stays_host" ON "stays" ("host_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stays_guest" ON "stays" ("guest_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_stays_review_due" ON "stays" ("ends_on") WHERE "review_requested_at" IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reviews" (
  "id" serial PRIMARY KEY,
  "stay_id" integer NOT NULL REFERENCES "stays"("id") ON DELETE CASCADE,
  "author_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "subject_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_reviews_stay_author" UNIQUE ("stay_id", "author_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_reviews_subject" ON "reviews" ("subject_id", "created_at");
