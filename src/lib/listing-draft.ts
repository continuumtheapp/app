/**
 * "Create with AI": turn an old Telegram post into a filled-in listing form.
 *
 * Most hosts already have their place written up as a group post. Instead of
 * retyping it, they paste it and Claude fills the form's fields; they check
 * everything and pick the address from the suggestions before posting.
 * Nothing is saved here: the result only pre-fills the form.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { toDayNumber, todayInBerlin, fromDayNumber } from "./dates";

export const MAX_POST_CHARS = 6000;

const Draft = z.object({
  title: z.string(),
  description: z.string(),
  address: z.string().nullable(),
  priceNightEuros: z.number().nullable(),
  priceWeekEuros: z.number().nullable(),
  priceMonthEuros: z.number().nullable(),
  depositEuros: z.number().nullable(),
  roomType: z.enum(["whole_flat", "shared"]).nullable(),
  flatmateCount: z.number().int().nullable(),
  maxGuests: z.number().int().nullable(),
  flintaOnly: z.boolean(),
  anmeldung: z.boolean(),
  petsAllowed: z.boolean(),
  periods: z.array(z.object({ start: z.string(), end: z.string() })),
  minNights: z.number().int().nullable(),
  maxNights: z.number().int().nullable(),
});

export type ListingDraft = z.infer<typeof Draft>;

const SYSTEM = `You fill in a listing form for SimbaCasa, a community board for sublets and rooms, anywhere in the world, from a post the host wrote earlier for a Telegram group.

Rules:
- Only use what the post says. If something isn't in the post, use null (or false for the yes/no fields, or an empty list for periods). Never guess a price, a date or an address.
- title: a short, plain title in English, under 80 characters, like "Bright room in Neukölln, near Hermannplatz".
- description: the host's own text about the place and the people, in the language it was written in, lightly cleaned up. Leave out prices, dates, contact details (usernames, phone numbers, emails, links) and hashtags: the form has its own fields for those, and people contact the host through the site.
- address: the street, cross street, square or station the post names, plus the district and the city, e.g. "Weserstraße, Neukölln, Berlin" or "Carrer de Verdi, Gràcia, Barcelona". Add the city if the post makes it clear. Null if it only names a district or a city, or nothing.
- Prices are whole numbers as the post gives them, in the local currency (£ in the UK, $ in the US, € in the euro area); the form uses the currency of the address. Don't convert between currencies. "Warm" rent is the price; ignore "kalt" rent if a warm one is given. Put a monthly price in priceMonthEuros, a weekly one in priceWeekEuros, a nightly one in priceNightEuros.
- roomType: "shared" for a room in a shared flat (WG), "whole_flat" for the whole flat or studio. flatmateCount: how many other people live there, only for a shared flat.
- flintaOnly: true only if the post says FLINTA, women only, or similar. anmeldung: true only if it says registration (Anmeldung) is possible; this only exists in Germany. petsAllowed: true only if it says pets are welcome.
- periods: when the place is free, as dates in YYYY-MM-DD; end is the move-out day. Resolve dates without a year to the next time that date comes after today. "From 1 December" with no end: leave periods empty unless a length is given.
- minNights/maxNights: only if the post states a minimum or maximum stay; convert weeks and months to nights (a month is 30 nights).`;

/** Read a pasted post. Returns null if Claude couldn't make sense of it. */
export async function draftFromPost(post: string): Promise<ListingDraft | null> {
  const client = new Anthropic();
  const today = fromDayNumber(todayInBerlin());

  const response = await client.beta.messages.parse({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    output_config: { effort: "low", format: betaZodOutputFormat(Draft) },
    // If the model declines, the API retries on another model in the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{
      role: "user",
      content: `Today is ${today}. Here is the post:\n\n<post>\n${post}\n</post>`,
    }],
  });

  if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens") return null;
  const draft = response.parsed_output;
  if (!draft) return null;

  // Keep only real, forward-looking periods: the form shows them on its calendar.
  const today_ = todayInBerlin();
  draft.periods = draft.periods.filter((p) => {
    try {
      const start = toDayNumber(p.start), end = toDayNumber(p.end);
      return end > start && end > today_;
    } catch {
      return false;
    }
  });
  return draft;
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}
