import { sql } from "drizzle-orm";
import {
  pgTable, serial, integer, text, boolean, real, bigint, timestamp,
  index, uniqueIndex, check, primaryKey, customType, type AnyPgColumn,
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
 * lat/lng pair forces. SimbaCasa needs that for listings now and for people and
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

  /**
   * The Telegram account this person signs in with. Numeric and permanent,
   * unlike the username, so it is the identity everything else hangs off.
   */
  telegramId: bigint("telegram_id", { mode: "number" }).unique(),

  // The Telegram @username, copied from Telegram on every sign-in — never
  // typed in — and required before posting or revealing another's contact.
  telegramHandle: text("telegram_handle"),
  /**
   * No longer used: Telegram is the only contact. Kept so the version of the
   * site still live (which reads it) keeps working against this database;
   * drop it once the new version is deployed.
   */
  whatsappNumber: text("whatsapp_number"),

  /** A few lines about themselves, shown on their profile. */
  bio: text("bio"),

  /* ---- Joining: every member is invited by another one (or was already in
     the Telegram group). An admin approves each new person. */

  /** pending → member, or rejected. Only members can post or contact people. */
  memberStatus: text("member_status", { enum: ["pending", "member", "rejected"] })
    .notNull().default("pending"),
  /** The secret in this member's personal invite link, /join/<code>. */
  inviteCode: text("invite_code").unique(),
  /** Whose invite link they joined through. Null for founding group members. */
  invitedById: text("invited_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  joinRequestedAt: timestamp("join_requested_at", { withTimezone: true }),
  reviewedById: text("reviewed_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),

  /* ---- ID check: needed before publishing an offer or a search. The photos
     are kept only until an admin has looked at them, then deleted; all that
     stays is when and by whom. */

  idCheckStatus: text("id_check_status", { enum: ["none", "submitted", "verified", "rejected"] })
    .notNull().default("none"),
  /** Private storage keys of the ID photo and the selfie. Null once checked. */
  idDocKey: text("id_doc_key"),
  idSelfieKey: text("id_selfie_key"),
  idSubmittedAt: timestamp("id_submitted_at", { withTimezone: true }),
  idCheckedAt: timestamp("id_checked_at", { withTimezone: true }),
  idCheckedById: text("id_checked_by_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),

  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_users_invited_by").on(t.invitedById),
  index("idx_users_member_status").on(t.memberStatus),
  // Empty strings would pass a NOT NULL check but are not a usable handle.
  check(
    "ck_users_contact_nonempty",
    sql`(${t.telegramHandle} IS NULL OR length(trim(${t.telegramHandle})) > 0)
    AND (${t.whatsappNumber} IS NULL OR length(trim(${t.whatsappNumber})) > 0)`,
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
  /** Required by better-auth 1.7+: the OIDC issuer the account came from. */
  issuer: text("issuer").notNull().default(""),
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

  // Geocoded once at save time, then never again. Anywhere in the world.
  address: text("address").notNull(),
  /** City and country (ISO code, e.g. "DE") the address is in. */
  city: text("city").notNull().default("Berlin"),
  country: text("country").notNull().default("DE"),
  /** ISO 4217, from the country. Every price on the listing is in it. */
  currency: text("currency").notNull().default("EUR"),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  /** PostGIS point kept in step with lat/lng, for distance queries. */
  location: geographyPoint("location").notNull(),

  // Money is always integer cents; never a float.
  //
  // A host can quote any combination of these — many offer a nightly rate for
  // short stays and a cheaper monthly one for long stays. At least one must be
  // set; search picks whichever suits the requested stay.
  priceNightCents: integer("price_night_cents"),
  priceWeekCents: integer("price_week_cents"),
  priceMonthCents: integer("price_month_cents"),
  // The cheapest available rate normalised to one night, denormalised at write
  // so budget filtering and sorting stay a single indexed integer compare.
  pricePerNightCents: integer("price_per_night_cents").notNull(),

  roomType: text("room_type", { enum: ["whole_flat", "shared"] }).notNull(),
  flatmateCount: integer("flatmate_count"),
  maxGuests: integer("max_guests").notNull().default(1),

  flintaOnly: boolean("flinta_only").notNull().default(false),
  depositCents: integer("deposit_cents").notNull().default(0), // 0 == no deposit

  // Hard requirements for many seekers, so requests can filter on them: a
  // third of Berlin long-term searches in the group ask for Anmeldung.
  anmeldung: boolean("anmeldung").notNull().default(false),
  petsAllowed: boolean("pets_allowed").notNull().default(false),

  // Host's stay bounds. NULL == unconstrained.
  minNights: integer("min_nights"),
  maxNights: integer("max_nights"),

  status: text("status", {
    enum: ["draft", "published", "taken", "hidden", "archived"],
  }).notNull().default("draft"),

  /** When the host ticked the Fair Rent Pledge. Null on listings from before it. */
  fairRentPledgedAt: timestamp("fair_rent_pledged_at", { withTimezone: true }),
  /** The bot's post about it in the group, so it can be taken down. */
  telegramMessageId: bigint("telegram_message_id", { mode: "number" }),

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
    sql`(${t.priceNightCents} IS NULL OR ${t.priceNightCents} >= 0)
    AND (${t.priceWeekCents} IS NULL OR ${t.priceWeekCents} >= 0)
    AND (${t.priceMonthCents} IS NULL OR ${t.priceMonthCents} >= 0)
    AND ${t.pricePerNightCents} >= 0 AND ${t.depositCents} >= 0`,
  ),
  // A listing with no price at all is not an offer.
  check(
    "ck_listings_has_price",
    sql`${t.priceNightCents} IS NOT NULL
     OR ${t.priceWeekCents} IS NOT NULL
     OR ${t.priceMonthCents} IS NOT NULL`,
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

/* --------------------------------------------------------------- requests */

/**
 * Someone looking for a place: the seeker's side of a listing.
 *
 * A request is an area and a stay, not an address. It expires on its own once
 * check-out has passed — see effectiveStatus() in src/lib/requests.ts — so
 * nobody has to repost or clean up.
 */
export const housingRequests = pgTable("housing_requests", {
  id: serial("id").primaryKey(),
  seekerId: text("seeker_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  /** The city searched in, its country (ISO code) and its centre. */
  city: text("city").notNull().default("Berlin"),
  country: text("country").notNull().default("DE"),
  /** ISO 4217, from the country: the budget is in it. */
  currency: text("currency").notNull().default("EUR"),
  cityLat: real("city_lat").notNull().default(52.52),
  cityLng: real("city_lng").notNull().default(13.405),
  /** Optional: why they're coming, what they'll be doing. Null == none. */
  note: text("note"),
  /** Preferred neighbourhoods. Empty == anywhere in the city. */
  areas: text("areas").array().notNull().default(sql`'{}'::text[]`),

  // Half-open [check_in, check_out), like every other interval here.
  checkIn: integer("check_in").notNull(),
  checkOut: integer("check_out").notNull(),
  datesFlexible: boolean("dates_flexible").notNull().default(false),

  roomType: text("room_type", { enum: ["whole_flat", "shared", "either"] }).notNull(),
  guests: integer("guests").notNull().default(1),
  withChildren: boolean("with_children").notNull().default(false),
  withPets: boolean("with_pets").notNull().default(false),

  // Optional. Integer cents for one period, like listing prices.
  maxBudgetCents: integer("max_budget_cents"),
  budgetPeriod: text("budget_period", { enum: ["night", "week", "month"] }),

  needsAnmeldung: boolean("needs_anmeldung").notNull().default(false),
  flintaOnly: boolean("flinta_only").notNull().default(false),

  status: text("status", { enum: ["open", "found", "closed"] }).notNull().default("open"),
  /** The bot's post about it in the group, so it can be taken down. */
  telegramMessageId: bigint("telegram_message_id", { mode: "number" }),

  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
}, (t) => [
  index("idx_requests_seeker").on(t.seekerId, t.updatedAt),
  index("idx_requests_open").on(t.status, t.checkOut),
  check("ck_requests_dates", sql`${t.checkOut} > ${t.checkIn}`),
  check("ck_requests_guests", sql`${t.guests} >= 1`),
  // A budget means nothing without its period, and vice versa.
  check(
    "ck_requests_budget",
    sql`(${t.maxBudgetCents} IS NULL) = (${t.budgetPeriod} IS NULL)
    AND (${t.maxBudgetCents} IS NULL OR ${t.maxBudgetCents} >= 0)`,
  ),
]);

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
export type AvailabilityBlock = typeof availabilityBlocks.$inferSelect;
export type User = typeof users.$inferSelect;
