import { sql } from "drizzle-orm";
import {
  pgTable, serial, integer, text, boolean, real, bigint, timestamp,
  index, uniqueIndex, check, primaryKey, customType,
} from "drizzle-orm/pg-core";

/**
 * All calendar dates are INTEGER day numbers (see src/lib/dates.ts).
 * All date intervals are half-open: [start_day, end_day), nights = end - start.
 */

/**
 * PostGIS geography point, stored as WGS84 (SRID 4326).
 *
 * A real spatial type, so distance queries ("within 5km of here") are exact and
 * index-backed by GiST rather than the bounding-box approximation a plain
 * lat/lng pair forces. Continuum needs that for listings now and for people and
 * events discovery later.
 *
 * Declared as `customType` returning a bare name because drizzle-kit quotes any
 * dataType() containing parentheses as an identifier, which produces invalid
 * DDL. The column's real type is set by drizzle/migrations/0001_postgis.sql,
 * which converts it to geography(Point,4326) and adds the GiST index.
 */
const geographyPoint = customType<{ data: { lat: number; lng: number }; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => `SRID=4326;POINT(${value.lng} ${value.lat})`,
});

/* ------------------------------------------------------------------ users */

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  name: text("name"),
  image: text("image"),

  // Contact details are mandatory before posting a listing or revealing another's.
  contactMethod: text("contact_method", { enum: ["telegram", "whatsapp"] }),
  contactHandle: text("contact_handle"),

  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  check(
    "ck_users_contact_paired",
    sql`(${t.contactMethod} IS NULL) = (${t.contactHandle} IS NULL)`,
  ),
]);

/* ------------------------------------------- better-auth managed tables */

/**
 * These four tables are written by better-auth, which passes JavaScript Date
 * objects — so their time columns are real timestamps, not the epoch-integer
 * `bigint` used elsewhere in this schema. Our own tables keep bigint because
 * we control those writes; mixing the two here would mean casting on every
 * insert better-auth makes.
 */

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idx_sessions_user").on(t.userId)]);

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_accounts_user").on(t.userId),
  uniqueIndex("uq_accounts_provider").on(t.providerId, t.accountId),
]);

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("idx_verifications_identifier").on(t.identifier)]);

/* --------------------------------------------------------------- listings */

export const listings = pgTable("listings", {
  id: serial("id").primaryKey(),
  hostId: text("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  description: text("description"),

  // Geocoded once at save time, then never again. Berlin bounding box enforced.
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  /** PostGIS point kept in step with lat/lng, for distance queries. */
  location: geographyPoint("location").notNull(),

  // Money is always integer cents; never a float.
  priceCents: integer("price_cents").notNull(),
  pricePeriod: text("price_period", { enum: ["night", "week", "month"] }).notNull(),
  // Denormalised at write (week/7, month/30) so budget filters are one indexed compare.
  pricePerNightCents: integer("price_per_night_cents").notNull(),

  roomType: text("room_type", { enum: ["whole_flat", "shared"] }).notNull(),
  flatmateCount: integer("flatmate_count"),
  maxGuests: integer("max_guests").notNull().default(1),

  flintaOnly: boolean("flinta_only").notNull().default(false),
  depositCents: integer("deposit_cents").notNull().default(0), // 0 == no deposit

  // Host's stay bounds. NULL == unconstrained.
  minNights: integer("min_nights"),
  maxNights: integer("max_nights"),

  status: text("status", {
    enum: ["draft", "published", "taken", "hidden", "archived"],
  }).notNull().default("draft"),

  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (t) => [
  index("idx_listings_status").on(t.status, t.updatedAt),
  index("idx_listings_price").on(t.pricePerNightCents),
  index("idx_listings_host").on(t.hostId),
  check(
    "ck_listings_nights",
    sql`(${t.minNights} IS NULL OR ${t.minNights} >= 1)
    AND (${t.maxNights} IS NULL OR ${t.maxNights} >= 1)
    AND (${t.minNights} IS NULL OR ${t.maxNights} IS NULL OR ${t.minNights} <= ${t.maxNights})`,
  ),
  // flatmate_count is present exactly when the room is shared.
  check(
    "ck_listings_shared",
    sql`(${t.roomType} = 'shared') = (${t.flatmateCount} IS NOT NULL)`,
  ),
  check(
    "ck_listings_money",
    sql`${t.priceCents} >= 0 AND ${t.pricePerNightCents} >= 0 AND ${t.depositCents} >= 0`,
  ),
  check("ck_listings_guests", sql`${t.maxGuests} >= 1`),
]);

/* ---------------------------------------------------- availability blocks */

/**
 * Blocks for one listing are kept DISJOINT AND NON-ADJACENT by mergeBlocks().
 * Matching assumes each block is a maximal contiguous run: adjacent blocks
 * [10,20) and [20,30) stored separately would each show only 10 nights and
 * would wrongly fail a 15-night minimum stay.
 */
export const availabilityBlocks = pgTable("availability_blocks", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),

  startDay: integer("start_day").notNull(),
  endDay: integer("end_day").notNull(),
}, (t) => [
  index("idx_blocks_listing_range").on(t.listingId, t.startDay, t.endDay),
  index("idx_blocks_range").on(t.startDay, t.endDay),
  check("ck_blocks_order", sql`${t.endDay} > ${t.startDay}`),
]);

/**
 * Days the host marked "maybe available".
 *
 * These are treated IDENTICALLY to normal availability for all matching and
 * filtering. The distinction is purely informational: the seeker sees that the
 * host isn't certain, and the two of them sort it out in chat.
 */
export const flexibleDays = pgTable("flexible_days", {
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  day: integer("day").notNull(),
}, (t) => [primaryKey({ columns: [t.listingId, t.day] })]);

/* ----------------------------------------------------------------- photos */

export const listingPhotos = pgTable("listing_photos", {
  id: serial("id").primaryKey(),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  r2Key: text("r2_key").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
}, (t) => [index("idx_photos_listing").on(t.listingId, t.sortOrder)]);

/* -------------------------------------------------- contact reveals, abuse */

export const contactReveals = pgTable("contact_reveals", {
  id: serial("id").primaryKey(),
  viewerId: text("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  revealedAt: bigint("revealed_at", { mode: "number" }).notNull(),
}, (t) => [
  index("idx_reveals_viewer_time").on(t.viewerId, t.revealedAt),
  index("idx_reveals_listing").on(t.listingId),
]);

export const reports = pgTable("reports", {
  id: serial("id").primaryKey(),
  reporterId: text("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  listingId: integer("listing_id")
    .notNull()
    .references(() => listings.id, { onDelete: "cascade" }),
  reason: text("reason").notNull(),
  status: text("status", { enum: ["open", "actioned", "dismissed"] })
    .notNull()
    .default("open"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  resolvedAt: bigint("resolved_at", { mode: "number" }),
}, (t) => [
  index("idx_reports_status").on(t.status, t.createdAt),
  uniqueIndex("uq_reports_reporter_listing").on(t.reporterId, t.listingId),
]);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
export type User = typeof users.$inferSelect;
