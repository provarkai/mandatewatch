// One-time seed script — run locally, never deployed, never runs in the browser.
//
// Usage:
//   node --env-file=.env.local scripts/seed.mjs
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (NOT the VITE_-prefixed
// anon key — this uses the service-role key, which bypasses Row Level Security, exactly what's
// needed to populate tables that the app's own RLS policies otherwise lock to read-only).
//
// Safe to re-run: every insert uses onConflict + ignoreDuplicates, so a partial failure followed
// by re-running this script won't create duplicate rows or error out.

import { createClient } from "@supabase/supabase-js";
import { REGIONS, LGAS_BY_STATE, SEN_DISTRICTS, FED_CONSTITUENCIES, STATE_CONSTITUENCIES } from "../src/data/geography.js";
import { PARTY_COLORS } from "../src/data/parties.js";
import { REPS } from "../src/data/reps.js";

// Accept either SUPABASE_URL or VITE_SUPABASE_URL -- the URL isn't sensitive (it's already
// public via the VITE_ prefix exposed to the browser), so no need to make the user set it twice.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    "Missing SUPABASE_URL (or VITE_SUPABASE_URL) or SUPABASE_SERVICE_ROLE_KEY.\n" +
    "Run with: node --env-file=.env.local scripts/seed.mjs\n" +
    "(and make sure both are set in .env.local — see .env.example)"
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const PARTY_NAMES = {
  APC: "All Progressives Congress",
  PDP: "Peoples Democratic Party",
  LP: "Labour Party",
  NNPP: "New Nigeria Peoples Party",
  ADC: "African Democratic Congress",
  APGA: "All Progressives Grand Alliance",
  YPP: "Young Progressives Party",
  SDP: "Social Democratic Party",
  ADP: "Action Democratic Party",
  APM: "Allied Peoples Movement",
  Accord: "Accord Party",
};

function must(condition, message) {
  if (!condition) throw new Error(message);
}

async function insertBatch(table, rows, conflictTarget) {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from(table)
    .upsert(rows, { onConflict: conflictTarget, ignoreDuplicates: true });
  if (error) throw new Error(`${table}: ${error.message}`);
  console.log(`  ${table}: ${rows.length} rows`);
}

async function main() {
  // --- Validate before writing anything (fail loud, not halfway through) ---
  const allStateNames = new Set(Object.values(REGIONS).flat());
  const repStates = new Set(REPS.map((r) => r.state));
  for (const s of repStates) {
    must(allStateNames.has(s), `REPS references state "${s}" not found in REGIONS`);
  }
  const repParties = new Set(REPS.map((r) => r.party));
  for (const p of repParties) {
    must(p in PARTY_COLORS, `REPS references party "${p}" not found in PARTY_COLORS`);
  }
  console.log(`Validated: ${repStates.size} distinct states, ${repParties.size} distinct parties across ${REPS.length} reps.\n`);

  // --- 1. states ---
  console.log("Seeding reference data...");
  const stateRows = Object.entries(REGIONS).flatMap(([region, states]) =>
    states.map((code) => ({ code, region }))
  );
  await insertBatch("states", stateRows, "code");

  // --- 2. lgas ---
  const lgaRows = Object.entries(LGAS_BY_STATE).flatMap(([state, lgas]) =>
    lgas.map((name) => ({ name, state_code: state }))
  );
  await insertBatch("lgas", lgaRows, "name,state_code");

  // --- 3. senatorial_districts / federal_constituencies / state_constituencies ---
  const senRows = SEN_DISTRICTS.map(([state, name, lgas]) => ({ state_code: state, name, lgas }));
  await insertBatch("senatorial_districts", senRows, "state_code,name");

  const fedRows = FED_CONSTITUENCIES.map(([state, name, lgas]) => ({ state_code: state, name, lgas }));
  await insertBatch("federal_constituencies", fedRows, "state_code,name");

  const stateConstRows = STATE_CONSTITUENCIES.map(([state, name, lgas]) => ({ state_code: state, name, lgas: lgas ?? null }));
  await insertBatch("state_constituencies", stateConstRows, "state_code,name");

  // --- 4. parties ---
  const partyRows = Object.entries(PARTY_COLORS).map(([code, color_hex]) => ({
    code,
    name: PARTY_NAMES[code] ?? code,
    color_hex,
    logo_url: null, // logos stay client-side base64 assets, not migrated to storage in this slice
  }));
  await insertBatch("parties", partyRows, "code");

  // --- 5. representatives ---
  console.log("\nSeeding representatives...");
  const repRows = REPS.map((r) => ({
    id: r.id,
    name: r.name,
    chamber: r.chamber,
    state_code: r.state,
    constituency: r.constituency,
    lga: r.lga ?? null,
    town: r.town ?? null,
    party_code: r.party,
    photo_url: r.photoUrl ?? null,
    role: r.role ?? null,
    elected_year: r.electedYear ?? null,
    term_start: r.termStart ?? null,
    term_end: r.termEnd ?? null,
    term_number: r.termNumber ?? null,
    // demands / topDemand / status intentionally not seeded — no home in this slice's schema;
    // the frontend merges those three fields from src/data/reps.js locally until the Demands
    // slice ships and replaces them with a real count.
  }));
  await insertBatch("representatives", repRows, "id");

  // Advance the id sequence past the max seeded id so future (e.g. admin-panel) inserts,
  // which rely on the serial default, don't collide with these explicit ids.
  const maxId = Math.max(...REPS.map((r) => r.id));
  const { error: seqError } = await supabase.rpc("setval_representatives_id_seq", { new_value: maxId });
  if (seqError) {
    console.warn(
      `  Could not auto-advance the id sequence (${seqError.message}). ` +
      `Run this manually once in the SQL Editor:\n` +
      `  select setval('representatives_id_seq', ${maxId});`
    );
  } else {
    console.log(`  representatives_id_seq advanced past ${maxId}`);
  }

  // --- 6. rep_scores — synthetic counts from each rep's current approval/presence percentage,
  // out of a 100-vote base, so the very first real vote moves the displayed percentage by a
  // small, statistically sensible amount instead of jumping by a full point.
  console.log("\nSeeding rep_scores...");
  const scoreRows = REPS.map((r) => ({
    rep_id: r.id,
    approval_up: r.approval,
    approval_down: 100 - r.approval,
    presence_up: r.presence,
    presence_down: 100 - r.presence,
  }));
  await insertBatch("rep_scores", scoreRows, "rep_id");

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
