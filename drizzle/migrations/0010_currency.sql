-- Prices in the local currency (18 Nov 2026), as posts in the group quote
-- them: £ in London, $ in New York. Everything until now was in euros.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'EUR';
--> statement-breakpoint
ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'EUR';
