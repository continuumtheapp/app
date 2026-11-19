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
import { addSampleContacts } from "./sample-contacts";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is not set. Copy .env.example to .env.local first.");
  process.exit(1);
}

const sql = postgres(DATABASE_URL, { prepare: false });

const MS_PER_DAY = 86_400_000;
const today = Math.floor(Date.now() / MS_PER_DAY);
const DAY0 = today + 7; // first availability starts a week out

// Members with and without a Telegram username, and the invite relations an
// admin sees: Dara joined through Anna's link, Eli through Cleo's. Finn has
// asked to join through Cleo's link and is waiting for approval; Gil has
// signed in but not asked yet, to try the join form.
const HOSTS = [
  { id: "u_anna", email: "u_anna@users.telegram.invalid", name: "Anna", telegram: "@anna_b", admin: true,
    status: "member", invitedBy: null, invite: null,
    bio: "Moved to Berlin in 2016. I run the SimbaCasa group and rent out my room when I travel." },
  { id: "u_ben", email: "u_ben@users.telegram.invalid", name: "Ben", telegram: null, admin: false,
    status: "member", invitedBy: null, invite: null, bio: null },
  { id: "u_cleo", email: "u_cleo@users.telegram.invalid", name: "Cleo", telegram: "@cleo_k", admin: false,
    status: "member", invitedBy: null, invite: null,
    bio: "Illustrator, quiet, cooks a lot. Usually looking for a room for a few weeks in summer." },
  { id: "u_dara", email: "u_dara@users.telegram.invalid", name: "Dara", telegram: "@dara_m", admin: false,
    status: "member", invitedBy: "u_anna", invite: null, bio: "Baker on Weserstraße. Two cats, early riser." },
  { id: "u_eli", email: "u_eli@users.telegram.invalid", name: "Eli", telegram: null, admin: false,
    status: "member", invitedBy: "u_cleo", invite: null, bio: "PhD student at the TU. Looking for something long-term in Wedding." },
  { id: "u_finn", email: "u_finn@users.telegram.invalid", name: "Finn", telegram: "@finn_r", admin: false,
    status: "pending", invitedBy: "u_cleo", invite: null, bio: "Just moved from Hamburg for a job at a studio. Tidy, plays guitar (quietly)." },
  { id: "u_gil", email: "u_gil@users.telegram.invalid", name: "Gil", telegram: "@gil_t", admin: false,
    status: "pending", invitedBy: null, invite: null, bio: null },
] as const;
/** Only approved members post; Finn is still waiting. */
const MEMBERS = HOSTS.filter((h) => h.status === "member");


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

/** Can publish straight away. Dara is a member without an ID check, to try that flow. */
const ID_CHECKED = new Set(["u_anna", "u_ben", "u_cleo", "u_eli"]);

async function main() {
  console.log("Clearing existing data…");
  await sql`TRUNCATE reviews, stays, contact_reveals, reports, listing_photos, flexible_days,
            availability_blocks, listings, sessions, accounts, verifications, users CASCADE`;

  for (const h of HOSTS) {
    await sql`INSERT INTO users (id, email, email_verified, name, telegram_handle,
                bio, member_status, invite_code, invited_by_id, join_requested_at,
                is_admin, is_banned, id_check_status, id_checked_at, created_at, updated_at)
              VALUES (${h.id}, ${h.email}, true, ${h.name}, ${h.telegram},
                ${h.bio}, ${h.status}, ${h.invite}, ${h.invitedBy},
                ${h.invitedBy ? new Date() : null}, ${h.admin}, false,
                ${ID_CHECKED.has(h.id) ? "verified" : "none"}, ${ID_CHECKED.has(h.id) ? new Date() : null},
                now(), now())`;
  }

  let blockCount = 0;
  let flexCount = 0;

  for (let i = 1; i <= 30; i++) {
    const host = MEMBERS[i % MEMBERS.length];
    const [area, baseLat, baseLng] = KIEZ[i % KIEZ.length];
    const lat = baseLat + (rand() - 0.5) * 0.024;
    const lng = baseLng + (rand() - 0.5) * 0.036;

    const shared = i % 3 !== 0;
    const flatmates = shared ? pick([1, 1, 2, 2, 3]) : null;
    const guests = shared ? pick([1, 1, 2]) : pick([2, 3, 4]);

    // Most hosts quote one or two rates; some quote all three. Longer periods
    // are priced cheaper per night, as they are in reality.
    const nightly = pick([35, 40, 45, 50, 55, 65, 80]) * 100;
    const shape = i % 4;
    const priceNight = shape === 3 ? null : nightly;
    const priceWeek = shape === 1 || shape === 2 ? Math.round(nightly * 7 * 0.85) : null;
    const priceMonth = shape === 2 || shape === 3 ? Math.round(nightly * 30 * 0.6) : null;

    const perNight = Math.min(
      ...[
        priceNight,
        priceWeek === null ? null : Math.round(priceWeek / 7),
        priceMonth === null ? null : Math.round(priceMonth / 30),
      ].filter((n): n is number => n !== null),
    );

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
        price_night_cents, price_week_cents, price_month_cents,
        price_per_night_cents, room_type, flatmate_count,
        max_guests, flinta_only, deposit_cents, anmeldung, pets_allowed,
        min_nights, max_nights, status,
        created_at, updated_at)
      VALUES (${host.id}, ${title}, ${description}, ${address}, ${lat}, ${lng},
        ST_MakePoint(${lng}, ${lat})::geography,
        ${priceNight}, ${priceWeek}, ${priceMonth},
        ${perNight}, ${shared ? "shared" : "whole_flat"},
        ${flatmates}, ${guests}, ${i % 7 === 0}, ${i % 4 === 0 ? 0 : pick([200, 300, 500]) * 100},
        ${i % 3 === 0}, ${i % 5 === 0},
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
  // Members who asked for each place's contact, so "Mark as taken" has guests to pick.
  const contacts = await addSampleContacts(sql);
  console.log(`Added ${contacts.contacts} sample contacts.`);
  await sql.end();
}

main().catch(async (error) => {
  console.error(error);
  await sql.end();
  process.exit(1);
});
