-- Turn listings.location into a real PostGIS geography column and index it.
--
-- Kept out of the drizzle-generated schema because drizzle-kit quotes any
-- parameterised type as an identifier, producing invalid DDL. The Drizzle
-- schema declares the column as text; this migration gives it its real type.

CREATE EXTENSION IF NOT EXISTS postgis;
--> statement-breakpoint
ALTER TABLE "listings"
  ALTER COLUMN "location" TYPE geography(Point,4326)
  USING "location"::geometry::geography;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_listings_location"
  ON "listings" USING gist ("location");
