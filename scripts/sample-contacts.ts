/**
 * Sample members who asked for a place's contact, so "Mark as taken" always
 * has someone to choose as the guest.
 *
 *   npx tsx --env-file=.env.local scripts/sample-contacts.ts
 *
 * Adds eight sample members (approved, but with no Telegram account and not
 * in the test sign-in list, so nobody can sign in as them) and gives every
 * place without contacts one to three of them, dated a few days back so they
 * don't count against anyone's daily contact limit. Safe to run again: it
 * only adds what's missing. scripts/seed.ts runs it at the end too.
 */
import type { Sql } from "postgres";

export const SAMPLE_CONTACTS = [
  { id: "u_s_jonas", name: "Jonas", telegram: "@jonas_w", bio: "Sound engineer, here for a festival season. Tidy, out a lot." },
  { id: "u_s_mira", name: "Mira", telegram: "@mira_h", bio: "Nurse at the Charité, night shifts. Quiet during the day." },
  { id: "u_s_sofia", name: "Sofía", telegram: "@sofia_lr", bio: "Architecture student from Valencia, doing a semester at the UdK." },
  { id: "u_s_tom", name: "Tom", telegram: "@tom_b", bio: "Remote developer, looking for a few months somewhere calm with good wifi." },
  { id: "u_s_lea", name: "Lea", telegram: "@lea_k", bio: "Moving from Munich for a new job. Plants, books, early mornings." },
  { id: "u_s_kemal", name: "Kemal", telegram: "@kemal_y", bio: "Chef, cooks for flatmates whether they like it or not." },
  { id: "u_s_priya", name: "Priya", telegram: "@priya_s", bio: "Researcher on a six-month fellowship. Non-smoker, no pets." },
  { id: "u_s_noah", name: "Noah", telegram: "@noah_f", bio: "Visiting my sister for the summer. Easy-going, happy to help around." },
] as const;

const DAY = 86_400_000;

export async function addSampleContacts(sql: Sql) {
  for (const p of SAMPLE_CONTACTS) {
    await sql`INSERT INTO users (id, email, email_verified, name, telegram_handle, bio,
                member_status, is_admin, is_banned, id_check_status, created_at, updated_at)
              VALUES (${p.id}, ${p.id + "@users.telegram.invalid"}, true, ${p.name}, ${p.telegram}, ${p.bio},
                'member', false, false, 'none', now(), now())
              ON CONFLICT (id) DO NOTHING`;
  }

  const places = await sql<{ id: number }[]>`
    SELECT l.id FROM listings l
    WHERE NOT EXISTS (SELECT 1 FROM contact_reveals r WHERE r.listing_id = l.id)
    ORDER BY l.id`;
  let added = 0;
  for (const { id } of places) {
    // Deterministic: the same places get the same people on every run.
    const count = 1 + (id % 3);
    for (let k = 0; k < count; k++) {
      const person = SAMPLE_CONTACTS[(id * 3 + k * 5) % SAMPLE_CONTACTS.length];
      const daysAgo = 2 + ((id + k * 4) % 10);
      await sql`INSERT INTO contact_reveals (viewer_id, listing_id, revealed_at)
                VALUES (${person.id}, ${id}, ${Date.now() - daysAgo * DAY - k * 3_600_000})`;
      added++;
    }
  }
  return { places: places.length, contacts: added };
}

// Run directly: npx tsx --env-file=.env.local scripts/sample-contacts.ts
if (process.argv[1]?.endsWith("sample-contacts.ts")) {
  (async () => {
    const { default: postgres } = await import("postgres");
    const sql = postgres(process.env.DATABASE_URL!, { prepare: false });
    const result = await addSampleContacts(sql);
    console.log(`Sample contacts: ${result.contacts} added across ${result.places} places.`);
    await sql.end();
  })();
}
