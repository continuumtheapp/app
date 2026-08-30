/**
 * Input validation. Every write path parses through these — never trust a form.
 */
import { z } from "zod";
import { toDayNumber } from "./dates";
import { MAX_PHOTOS_PER_LISTING } from "./photos";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use the date picker")
  .refine((s) => { try { toDayNumber(s); return true; } catch { return false; } }, "Not a real date");

export const contactSchema = z.object({
  contactMethod: z.enum(["telegram", "whatsapp"]),
  contactHandle: z.string().trim().min(2, "Too short").max(64, "Too long")
    .refine((h) => !h.includes(" "), "Handles don't contain spaces"),
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

    priceCents: z.number().int().min(0, "Price can't be negative").max(100_000_00),
    pricePeriod: z.enum(["night", "week", "month"]),

    roomType: z.enum(["whole_flat", "shared"]),
    flatmateCount: z.number().int().min(0).max(20).nullable(),
    maxGuests: z.number().int().min(1, "At least one").max(20),

    flintaOnly: z.boolean(),
    depositCents: z.number().int().min(0).max(100_000_00),

    minNights: z.number().int().min(1).max(365).nullable(),
    maxNights: z.number().int().min(1).max(365).nullable(),

    blocks: z.array(availabilityBlockSchema).min(1, "Add at least one period of availability"),
    flexibleDays: z.array(isoDate).max(366),
    photoKeys: z.array(z.string()).max(MAX_PHOTOS_PER_LISTING,
      `At most ${MAX_PHOTOS_PER_LISTING} photos`),
  })
  // A shared room needs a flatmate count; a whole flat must not have one.
  .refine((l) => (l.roomType === "shared") === (l.flatmateCount !== null), {
    message: "Say how many people you'd be sharing with",
    path: ["flatmateCount"],
  })
  .refine((l) => l.minNights === null || l.maxNights === null || l.minNights <= l.maxNights, {
    message: "The shortest stay can't be longer than the longest",
    path: ["maxNights"],
  });

export type ListingInput = z.infer<typeof listingSchema>;

export const searchSchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.coerce.number().int().min(1).max(20).default(1),
  maxPrice: z.coerce.number().int().min(0).nullable().default(null),
  roomType: z.enum(["whole_flat", "shared"]).nullable().default(null),
  noDeposit: z.coerce.boolean().default(false),
  flintaOnly: z.coerce.boolean().default(false),
  bbox: z.string().nullable().default(null),
}).refine((s) => toDayNumber(s.checkOut) > toDayNumber(s.checkIn), {
  message: "Check-out must be after check-in",
  path: ["checkOut"],
});

export const reportSchema = z.object({
  listingId: z.number().int().positive(),
  reason: z.string().trim().min(10, "Tell us a little more").max(1000),
});
