/**
 * Input validation. Every write path parses through these — never trust a form.
 */
import { z } from "zod";
import { toDayNumber } from "./dates";
import { MAX_PHOTOS_PER_LISTING } from "./photos";
import { areasFor } from "./areas";
import { REQUEST_NOTE_MAX } from "./request-rules";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
  .refine((s) => { try { toDayNumber(s); return true; } catch { return false; } }, "Not a real date");

/** A photo uploaded through /api/photos/upload-url with purpose "avatar". */
const avatarKey = z.string().regex(/^avatars\/[0-9a-f-]{36}\.(jpg|png|webp)$/, "Upload the photo again");

/** The editable part of a profile. The Telegram @username comes from Telegram. */
export const profileSchema = z.object({
  name: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600, "Keep it under 600 characters").optional(),
  /** Omitted: keep the current photo. Null: remove it. */
  avatarKey: avatarKey.nullable().optional(),
});

/**
 * Asking to join: through someone's invite link (code), or without one by
 * someone already in the Telegram group. It's just their profile: who
 * invited them comes from the link.
 */
export const joinSchema = z.object({
  code: z.string().trim().min(1).max(64).nullable(),
  name: z.string().trim().min(1, "What should people call you?").max(80),
  bio: z.string().trim().min(3, "Write a few lines about yourself").max(600, "Keep it under 600 characters"),
  avatarKey: avatarKey.nullable().optional(),
});

export const availabilityBlockSchema = z
  .object({ start: isoDate, end: isoDate })
  .refine((b) => toDayNumber(b.end) > toDayNumber(b.start), {
    message: "The end date must be after the start date",
    path: ["end"],
  });

export const listingSchema = z
  .object({
    title: z.string().trim().min(4, "Give it a title").max(120, "Keep the title under 120 characters"),
    description: z.string().trim().max(4000, "Keep the description under 4000 characters").optional(),
    address: z.string().trim().min(4, "Where is it?").max(200),
    // Captured when the host picks a suggestion, so the pin matches the text.
    lat: z.number().min(-90).max(90).nullable(),
    lng: z.number().min(-180).max(180).nullable(),

    // Any combination; at least one is required (checked below).
    priceNightCents: z.number().int().min(0).max(100_000_00).nullable(),
    priceWeekCents: z.number().int().min(0).max(100_000_00).nullable(),
    priceMonthCents: z.number().int().min(0).max(100_000_00).nullable(),

    roomType: z.enum(["whole_flat", "shared"]),
    flatmateCount: z.number().int().min(0).max(20).nullable(),
    maxGuests: z.number().int().min(1, "At least one").max(20),

    flintaOnly: z.boolean(),
    depositCents: z.number().int().min(0).max(100_000_00),
    anmeldung: z.boolean().default(false),
    petsAllowed: z.boolean().default(false),

    minNights: z.number().int().min(1).max(365).nullable(),
    maxNights: z.number().int().min(1).max(365).nullable(),

    blocks: z.array(availabilityBlockSchema).min(1, "Add at least one period of availability"),
    flexibleDays: z.array(isoDate).max(366),
    photoKeys: z.array(z.string()).max(MAX_PHOTOS_PER_LISTING,
      `At most ${MAX_PHOTOS_PER_LISTING} photos`),
    fairRentPledge: z.literal(true, { error: "Tick the Fair Rent Pledge to post" }),
  })
  // A shared room needs a flatmate count; a whole flat must not have one.
  .refine((l) => (l.roomType === "shared") === (l.flatmateCount !== null), {
    message: "Say how many people you'd be sharing with",
    path: ["flatmateCount"],
  })
  .refine((l) => l.minNights === null || l.maxNights === null || l.minNights <= l.maxNights, {
    message: "The shortest stay can't be longer than the longest",
    path: ["maxNights"],
  })
  .refine(
    (l) => l.priceNightCents !== null || l.priceWeekCents !== null || l.priceMonthCents !== null,
    { message: "Give a price for at least one period", path: ["priceNightCents"] },
  );

export type ListingInput = z.infer<typeof listingSchema>;

export const searchSchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.coerce.number().int().min(1).max(20).default(1),
  maxPrice: z.coerce.number().int().min(0).nullable().default(null),
  roomType: z.enum(["whole_flat", "shared"]).nullable().default(null),
  flintaOnly: z.coerce.boolean().default(false),
  anmeldung: z.coerce.boolean().default(false),
  pets: z.coerce.boolean().default(false),
  bbox: z.string().nullable().default(null),
}).refine((s) => toDayNumber(s.checkOut) > toDayNumber(s.checkIn), {
  message: "Check-out must be after check-in",
  path: ["checkOut"],
});

export const requestSchema = z
  .object({
    checkIn: isoDate,
    checkOut: isoDate,
    datesFlexible: z.boolean(),
    city: z.string().trim().min(1, "Which city?").max(100),
    country: z.string().regex(/^[A-Z]{2}$/, "Pick the city from the suggestions"),
    cityLat: z.number().min(-90).max(90),
    cityLng: z.number().min(-180).max(180),
    areas: z.array(z.string().max(60)).max(30),
    note: z.string().trim().max(REQUEST_NOTE_MAX).nullable().transform((n) => n || null),
    roomType: z.enum(["whole_flat", "shared", "either"]),
    guests: z.number().int().min(1, "At least one").max(20),
    withChildren: z.boolean(),
    withPets: z.boolean(),
    maxBudgetCents: z.number().int().min(0).max(100_000_00).nullable(),
    budgetPeriod: z.enum(["night", "week", "month"]),
    needsAnmeldung: z.boolean(),
    flintaOnly: z.boolean(),
  })
  .refine((r) => toDayNumber(r.checkOut) > toDayNumber(r.checkIn), {
    message: "The move-out date must be after the move-in date",
    path: ["checkOut"],
  })
  // Only the neighbourhoods we offer for that city, and none elsewhere.
  .refine((r) => r.areas.every((a) => areasFor(r.city, r.country).includes(a)), {
    message: "Pick neighbourhoods from the list",
    path: ["areas"],
  });

export type RequestInput = z.infer<typeof requestSchema>;

export const reportSchema = z.object({
  listingId: z.number().int().positive(),
  reason: z.string().trim().min(10, "Tell us a little more").max(1000),
});
