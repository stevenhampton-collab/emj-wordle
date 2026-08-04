// ISO-week helpers, all anchored to US Pacific time.
//
// The game's week runs Monday 00:00 America/Los_Angeles through the following
// Sunday, and resets automatically at the Monday boundary. We derive the
// current Pacific calendar date with Intl (so it's correct through PST/PDT
// changes), then do the week math in UTC to keep it free of DST edge cases.

const PACIFIC_TZ = "America/Los_Angeles";

/** The Pacific-local calendar date (year, month 1-12, day) for an instant. */
export function pacificYMD(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** ISO week number + ISO year for a calendar date (month is 1-12). */
function isoWeekFromYMD(
  year: number,
  month: number,
  day: number,
): { isoYear: number; isoWeek: number } {
  const date = new Date(Date.UTC(year, month - 1, day));
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // move to the week's Thursday
  const isoYear = date.getUTCFullYear();
  const firstThursday = new Date(Date.UTC(isoYear, 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const isoWeek =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return { isoYear, isoWeek };
}

function formatWeek(isoYear: number, isoWeek: number): string {
  return `${isoYear}-W${String(isoWeek).padStart(2, "0")}`;
}

/** Parse "2026-W32" into its numeric parts. */
function parseWeek(week: string): { isoYear: number; isoWeek: number } {
  const m = /^(\d{4})-W(\d{2})$/.exec(week.trim());
  if (!m) throw new Error(`Invalid ISO week string: ${week}`);
  return { isoYear: Number(m[1]), isoWeek: Number(m[2]) };
}

/** UTC-midnight Date of the Monday that starts a given ISO week. */
function isoWeekToMonday(isoYear: number, isoWeek: number): Date {
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7; // Mon=0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4DayNum);
  const monday = new Date(week1Monday);
  monday.setUTCDate(week1Monday.getUTCDate() + (isoWeek - 1) * 7);
  return monday;
}

/** The current ISO week string in Pacific time, e.g. "2026-W32". */
export function currentIsoWeek(date: Date = new Date()): string {
  const { year, month, day } = pacificYMD(date);
  const { isoYear, isoWeek } = isoWeekFromYMD(year, month, day);
  return formatWeek(isoYear, isoWeek);
}

/** The ISO week immediately before the given one. */
export function previousIsoWeek(week: string): string {
  const { isoYear, isoWeek } = parseWeek(week);
  const monday = isoWeekToMonday(isoYear, isoWeek);
  monday.setUTCDate(monday.getUTCDate() - 7);
  const prev = isoWeekFromYMD(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
  );
  return formatWeek(prev.isoYear, prev.isoWeek);
}

/** True when `later` is exactly the week after `earlier` (no gap). */
export function areConsecutive(earlier: string, later: string): boolean {
  return previousIsoWeek(later) === earlier;
}

/** A friendly header label, e.g. "Week of Aug 4". */
export function weekLabel(week: string): string {
  const { isoYear, isoWeek } = parseWeek(week);
  const monday = isoWeekToMonday(isoYear, isoWeek);
  const formatted = monday.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  return `Week of ${formatted}`;
}
