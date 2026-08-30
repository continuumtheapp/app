/**
 * Development seed: ~30 Berlin listings covering the interesting cases.
 *   npm run db:seed
 *
 * Dates are generated relative to TODAY, deliberately. Search clamps check-in
 * to the current date, so a seed anchored to fixed dates silently stops
 * matching anything once those dates pass.
 */
import "dotenv/config";
import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

const MS_PER_DAY = 86_400_000;
const today = Math.floor(Date.now() / MS_PER_DAY);
const DAY0 = today + 7; // first availability starts a week out

const HOSTS = [
  { id: "u_anna", email: "anna@example.de", name: "Anna", method: "telegram", handle: "@anna_b", admin: true },
  { id: "u_ben", email: "ben@example.de", name: "Ben", method: "whatsapp", handle: "+4917012345678", admin: false },
  { id: "u_cleo", email: "cleo@example.de", name: "Cleo", method: "telegram", handle: "@cleo_k", admin: false },
  { id: "u_dara", email: "dara@example.de", name: "Dara", method: "telegram", handle: "@dara_m", admin: false },
  { id: "u_eli", email: "eli@example.de", name: "Eli", method: "whatsapp", handle: "+4917098765432", admin: false },
];

const KIEZ = [
  ["Neukölln", 52.481, 13.435], ["Kreuzberg", 52.498, 13.403],
  ["Prenzlauer Berg", 52.54, 13.424], ["Friedrichshain", 52.515, 13.454],
  ["Wedding", 52.549, 13.365], ["Mitte", 52.525, 13.402],
  ["Charlottenburg", 52.506, 13.304], ["Schöneberg", 52.483, 13.355],
  ["Moabit", 52.529, 13.342], ["Treptow", 52.493, 13.456],
] as const;

// Titles must match the room type, or listings read as self-contradictory.
const SHARED_TITLES = ["Sunny room with a balcony", "Bright room in a shared flat",
  "Room in an old-build flat", "Airy room facing the park",
  "Room in a friendly WG", "Quiet room off the courtyard"];
const WHOLE_TITLES = ["Whole flat, top floor", "Small studio near the canal",
  "Whole flat with a garden", "Compact flat, everything nearby",
  "Quiet studio off the courtyard", "Bright flat facing the park"];
const SHARED_DESCS = [
  "We're two people who work normal hours and cook a lot. Cat included, unfortunately.",
  "Friendly flat, everyone does their own thing but we eat together sometimes.",
  "Big kitchen, plants everywhere, washing machine. Bike storage in the courtyard."];
const WHOLE_DESCS = [
  "Right by the U-Bahn, five minutes to the canal. Quiet at night despite the location.",
  "Second floor of an Altbau, high ceilings, big windows. Bakery downstairs.",
  "Small but well laid out. Good light in the mornings, desk by the window."];
const STREETS = ["Weserstr", "Sonnenallee", "Kastanienallee", "Boxhagener Str", "Torstr", "Bergmannstr"];

/** Deterministic PRNG, so reseeding gives the same data. */
let seed = 7;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];

async function main() {
  console.log("Clearing existing data…");
  await sql`TRUNCATE contact_reveals, reports, listing_photos, flexible_days,
            availability_blocks, listings, sessions, accounts, verifications, users CASCADE`;

  for (const h of HOSTS) {
    await sql`INSERT INTO users (id, email, email_verified, name, contact_method,
                contact_handle, is_admin, is_banned, created_at, updated_at)
              VALUES (${h.id}, ${h.email}, true, ${h.name}, ${h.method},
                ${h.handle}, ${h.admin}, false, ${Date.now()}, ${Date.now()})`;
  }

  let blockCount = 0;
  let flexCount = 0;

  for (let i = 1; i <= 30; i++) {
    const host = HOSTS[i % HOSTS.length];
    const [area, baseLat, baseLng] = KIEZ[i % KIEZ.length];
    const lat = baseLat + (rand() - 0.5) * 0.024;
    const lng = baseLng + (rand() - 0.5) * 0.036;

    const shared = i % 3 !== 0;
    const flatmates = shared ? pick([1, 1, 2, 2, 3]) : null;
    const guests = shared ? pick([1, 1, 2]) : pick([2, 3, 4]);

    const period = pick(["night", "week", "month", "month"] as const);
    const price = {
      night: pick([35, 40, 45, 50, 55, 65, 80]),
      week: pick([220, 260, 300, 350, 400]),
      month: pick([550, 650, 700, 800, 900, 1100]),
    }[period] * 100;
    const perNight = Math.round(price / { night: 1, week: 7, month: 30 }[period]);

    // A spread of host stay-length constraints, including none at all.
    const [minN, maxN] = [
      [null, null], [pick([5, 7, 14]), null], [null, pick([10, 14, 21])],
      [7, 30], [28, null],
    ][i % 5] as [number | null, number | null];

    const title = `${(shared ? SHARED_TITLES : WHOLE_TITLES)[i % 6]}, ${area}`;
    const description = (shared ? SHARED_DESCS : WHOLE_DESCS)[i % 3];
    const address = `${Math.floor(rand() * 180) + 1} ${pick(STREETS)}, ${area}`;

    const [{ id }] = await sql<{ id: number }[]>`
      INSERT INTO listings (host_id, title, description, address, lat, lng, location,
        price_cents, price_period, price_per_night_cents, room_type, flatmate_count,
        max_guests, flinta_only, deposit_cents, min_nights, max_nights, status,
        created_at, updated_at)
      VALUES (${host.id}, ${title}, ${description}, ${address}, ${lat}, ${lng},
        ST_MakePoint(${lng}, ${lat})::geography,
        ${price}, ${period}, ${perNight}, ${shared ? "shared" : "whole_flat"},
        ${flatmates}, ${guests}, ${i % 7 === 0}, ${i % 4 === 0 ? 0 : pick([200, 300, 500]) * 100},
        ${minN}, ${maxN}, 'published', ${Date.now()}, ${Date.now()})
      RETURNING id`;

    // A mix of long spans, short windows, gaps, and near-miss shapes.
    const spans: [number, number][] = [
      [[DAY0, DAY0 + 62]],
      [[DAY0 + Math.floor(rand() * 6), DAY0 + 20 + Math.floor(rand() * 12)]],
      [[DAY0, DAY0 + 12], [DAY0 + 20, DAY0 + 50]],
      [[DAY0 + 8 + Math.floor(rand() * 8), DAY0 + 40 + Math.floor(rand() * 30)]],
      [[DAY0 - 10, DAY0 + 9]],
      [[DAY0 + 2 + Math.floor(rand() * 3), DAY0 + 14 + Math.floor(rand() * 10)], [DAY0 + 45, DAY0 + 75]],
    ][i % 6] as [number, number][];

    for (const [start, end] of spans) {
      await sql`INSERT INTO availability_blocks (listing_id, start_day, end_day)
                VALUES (${id}, ${start}, ${end})`;
      blockCount++;
    }

    // Some hosts flag the last few days as not yet certain.
    if (i % 4 === 1) {
      const [, end] = spans[0];
      for (let day = end - 4; day < end; day++) {
        await sql`INSERT INTO flexible_days (listing_id, day) VALUES (${id}, ${day})`;
        flexCount++;
      }
    }
  }

  console.log(`Seeded 30 listings, ${blockCount} availability blocks, ${flexCount} flexible days.`);
  console.log(`Availability starts ${new Date(DAY0 * MS_PER_DAY).toISOString().slice(0, 10)}.`);
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
