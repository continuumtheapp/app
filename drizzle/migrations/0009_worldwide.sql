-- Launching everywhere at once, not just Berlin (18 Nov 2026). Listings keep
-- the city and country their address is in; searches keep the city's centre,
-- so matching places can be found around it. Everything until now was Berlin.

ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "city" text NOT NULL DEFAULT 'Berlin';
--> statement-breakpoint
-- ISO 3166-1 alpha-2, e.g. "DE".
ALTER TABLE "listings" ADD COLUMN IF NOT EXISTS "country" text NOT NULL DEFAULT 'DE';
--> statement-breakpoint
ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "country" text NOT NULL DEFAULT 'DE';
--> statement-breakpoint
ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "city_lat" real NOT NULL DEFAULT 52.52;
--> statement-breakpoint
ALTER TABLE "housing_requests" ADD COLUMN IF NOT EXISTS "city_lng" real NOT NULL DEFAULT 13.405;
