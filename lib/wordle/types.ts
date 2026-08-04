// Shared types for EMJ Wordle — the weekly word game for the Every Man Jack team.

/** Per-letter feedback after a guess is scored against the answer. */
export type TileState = "correct" | "present" | "absent";

/** How a single week turned out for a player. */
export type WeekResultStatus = "win" | "loss" | "in_progress";

/** One week's record inside a player's history. */
export interface WeekRecord {
  result: WeekResultStatus;
  /** Number of guesses used (1-6). For a loss this is 6. */
  guesses: number;
  /** The raw 5-letter guesses made so far, uppercase — used to resume a board. */
  board: string[];
}

/**
 * A player's full record. Stored in the KV store under `player:{email}`.
 * Email is the unique identifier; name is what shows on the leaderboard.
 */
export interface PlayerRecord {
  email: string;
  name: string;
  weeks: Record<string, WeekRecord>; // keyed by ISO week, e.g. "2026-W32"
  currentStreak: number;
  bestStreak: number;
  totalWins: number;
  totalPlayed: number;
}

/** A compact player summary kept in the `leaderboard` index for fast rendering. */
export interface LeaderboardEntry {
  email: string;
  name: string;
  currentStreak: number;
  bestStreak: number;
  totalWins: number;
  totalPlayed: number;
}

/** One scored row shown on the board (a submitted guess + its per-letter states). */
export interface ScoredGuess {
  guess: string;
  tiles: TileState[];
}
