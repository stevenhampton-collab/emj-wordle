// The weekly word — sourced from a Google Sheet the (non-technical) team manages.
//
// The sheet has two columns: Week (ISO, e.g. "2026-W32") and Word (5-letter,
// uppercase). We read it with a read-only API key over plain HTTPS — no SDK,
// no OAuth. If the sheet isn't configured yet, we fall back to a built-in
// starter bank so the game still works in preview/dev. If the sheet IS
// configured but has no row for this week, we return null so the page can show
// the friendly "No word this week" message.

// Ordered by priority: EMJ/product first, grooming next, then outdoor/nature.
export const STARTER_BANK: string[] = [
  // EMJ & product specific
  "CEDAR", "BEARD", "SCRUB", "BLADE", "TONER", "BALMS", "SHAVE", "BRUSH",
  "CLEAN", "FRESH", "RINSE", "SPRAY", "CRAFT", "BUILT", "TOUGH", "DAILY",
  "VITAL", "POWER", "RENEW", "BOOST", "GRIND", "FOCUS", "EVERY", "JACKS",
  "PRIDE",
  // Men's grooming adjacent
  "RAZOR", "FOAMY", "SWIPE", "PUMPS", "FLOSS", "LEMON", "LIMES", "SALTS",
  "HERBS", "SPICE", "THYME", "BASIL", "CLOVE", "MYRRH", "OLIVE", "ARGAN",
  "ALGAE", "RESIN", "TONIC",
  // Outdoor & adventure
  "TRAIL", "RIDGE", "PEAKS", "CREEK", "STONE", "OZONE", "FROST", "SMOKE",
  "EMBER", "ASPEN", "MAPLE", "BIRCH", "PINES", "GROVE", "FJORD", "RIVER",
  "OCEAN", "WOODS", "TIDES", "SHORE", "DUNES", "FERNS", "MOSSY", "ROCKY",
  "STORM", "MISTY", "SEDGE",
];

export function isSheetsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_ID && process.env.GOOGLE_SHEETS_API_KEY);
}

function isValidWord(w: unknown): w is string {
  return typeof w === "string" && /^[A-Za-z]{5}$/.test(w.trim());
}

// A stable index into the starter bank, derived from the week string so the
// fallback word is consistent all week and varies from week to week.
function fallbackWord(week: string): string {
  let hash = 0;
  for (let i = 0; i < week.length; i++) {
    hash = (hash * 31 + week.charCodeAt(i)) >>> 0;
  }
  return STARTER_BANK[hash % STARTER_BANK.length];
}

async function fetchFromSheet(week: string): Promise<string | null> {
  const id = process.env.GOOGLE_SHEETS_ID!;
  const key = process.env.GOOGLE_SHEETS_API_KEY!;
  const range = process.env.GOOGLE_SHEETS_RANGE || "A:B";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    id,
  )}/values/${encodeURIComponent(range)}?key=${encodeURIComponent(key)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Google Sheets responded ${res.status}`);
  }
  const data = (await res.json()) as { values?: string[][] };
  const rows = data.values || [];
  const target = week.trim().toLowerCase();
  for (const row of rows) {
    const rowWeek = (row[0] || "").trim().toLowerCase();
    if (rowWeek === target && isValidWord(row[1])) {
      return row[1].trim().toUpperCase();
    }
  }
  return null; // sheet is live but has no (valid) row for this week
}

/**
 * The answer for a given ISO week, uppercase, or null when the sheet is live
 * but has no word for that week. Falls back to the starter bank when the sheet
 * isn't configured. Never throws — a sheet error falls back too.
 */
export async function getWordForWeek(week: string): Promise<string | null> {
  if (!isSheetsConfigured()) {
    return fallbackWord(week);
  }
  try {
    return await fetchFromSheet(week);
  } catch (err) {
    console.error("Google Sheets word lookup failed; using fallback:", err);
    return fallbackWord(week);
  }
}
