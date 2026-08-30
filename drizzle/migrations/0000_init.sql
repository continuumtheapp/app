CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" bigint,
	"refresh_token_expires_at" bigint,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "availability_blocks" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"start_day" integer NOT NULL,
	"end_day" integer NOT NULL,
	CONSTRAINT "ck_blocks_order" CHECK ("availability_blocks"."end_day" > "availability_blocks"."start_day")
);
--> statement-breakpoint
CREATE TABLE "contact_reveals" (
	"id" serial PRIMARY KEY NOT NULL,
	"viewer_id" text NOT NULL,
	"listing_id" integer NOT NULL,
	"revealed_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "flexible_days" (
	"listing_id" integer NOT NULL,
	"day" integer NOT NULL,
	CONSTRAINT "flexible_days_listing_id_day_pk" PRIMARY KEY("listing_id","day")
);
--> statement-breakpoint
CREATE TABLE "listing_photos" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"r2_key" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"host_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"address" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"location" text NOT NULL,
	"price_cents" integer NOT NULL,
	"price_period" text NOT NULL,
	"price_per_night_cents" integer NOT NULL,
	"room_type" text NOT NULL,
	"flatmate_count" integer,
	"max_guests" integer DEFAULT 1 NOT NULL,
	"flinta_only" boolean DEFAULT false NOT NULL,
	"deposit_cents" integer DEFAULT 0 NOT NULL,
	"min_nights" integer,
	"max_nights" integer,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "ck_listings_nights" CHECK (("listings"."min_nights" IS NULL OR "listings"."min_nights" >= 1)
    AND ("listings"."max_nights" IS NULL OR "listings"."max_nights" >= 1)
    AND ("listings"."min_nights" IS NULL OR "listings"."max_nights" IS NULL OR "listings"."min_nights" <= "listings"."max_nights")),
	CONSTRAINT "ck_listings_shared" CHECK (("listings"."room_type" = 'shared') = ("listings"."flatmate_count" IS NOT NULL)),
	CONSTRAINT "ck_listings_money" CHECK ("listings"."price_cents" >= 0 AND "listings"."price_per_night_cents" >= 0 AND "listings"."deposit_cents" >= 0),
	CONSTRAINT "ck_listings_guests" CHECK ("listings"."max_guests" >= 1)
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"reporter_id" text NOT NULL,
	"listing_id" integer NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" text,
	"image" text,
	"contact_method" text,
	"contact_handle" text,
	"is_admin" boolean DEFAULT false NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "ck_users_contact_paired" CHECK (("users"."contact_method" IS NULL) = ("users"."contact_handle" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "availability_blocks" ADD CONSTRAINT "availability_blocks_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_viewer_id_users_id_fk" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_reveals" ADD CONSTRAINT "contact_reveals_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flexible_days" ADD CONSTRAINT "flexible_days_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_photos" ADD CONSTRAINT "listing_photos_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reports" ADD CONSTRAINT "reports_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_accounts_provider" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "idx_blocks_listing_range" ON "availability_blocks" USING btree ("listing_id","start_day","end_day");--> statement-breakpoint
CREATE INDEX "idx_blocks_range" ON "availability_blocks" USING btree ("start_day","end_day");--> statement-breakpoint
CREATE INDEX "idx_reveals_viewer_time" ON "contact_reveals" USING btree ("viewer_id","revealed_at");--> statement-breakpoint
CREATE INDEX "idx_reveals_listing" ON "contact_reveals" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_photos_listing" ON "listing_photos" USING btree ("listing_id","sort_order");--> statement-breakpoint
CREATE INDEX "idx_listings_status" ON "listings" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "idx_listings_price" ON "listings" USING btree ("price_per_night_cents");--> statement-breakpoint
CREATE INDEX "idx_listings_host" ON "listings" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "idx_reports_status" ON "reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_reports_reporter_listing" ON "reports" USING btree ("reporter_id","listing_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_verifications_identifier" ON "verifications" USING btree ("identifier");