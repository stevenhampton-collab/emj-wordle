// Core game rules: scoring a guess and recomputing a player's stats/streaks.

import { areConsecutive, previousIsoWeek } from "./week";
import type { PlayerRecord, ScoredGuess, TileState } from "./types";

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

/**
 * Score a guess against the answer using standard Wordle rules, including
 * correct handling of duplicate letters: exact matches are marked first, then
 * remaining letters are marked "present" only while unmatched copies remain.
 * Both inputs are expected to be 5 uppercase letters.
 */
export function scoreGuess(guess: string, answer: string): TileState[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const tiles: TileState[] = new Array(g.length).fill("absent");
  const remaining: Record<string, number> = {};

  // First pass: exact position matches.
  for (let i = 0; i < g.length; i++) {
    if (g[i] === a[i]) {
      tiles[i] = "correct";
    } else {
      remaining[a[i]] = (remaining[a[i]] || 0) + 1;
    }
  }
  // Second pass: present-but-misplaced, limited by remaining letter counts.
  for (let i = 0; i < g.length; i++) {
    if (tiles[i] === "correct") continue;
    const c = g[i];
    if (remaining[c] > 0) {
      tiles[i] = "present";
      remaining[c] -= 1;
    }
  }
  return tiles;
}

/** Rebuild the scored rows for a stored board (used to resume a game). */
export function scoreBoard(board: string[], answer: string): ScoredGuess[] {
  return board.map((guess) => ({ guess, tiles: scoreGuess(guess, answer) }));
}

/**
 * Recompute a player's aggregate stats and streaks from their weeks map.
 * Called after every completed game so the stored fields stay authoritative.
 *
 * - currentStreak: consecutive winning weeks ending at the current week (or the
 *   previous week if the current one isn't finished yet). A loss or a missed
 *   week breaks it.
 * - bestStreak: the longest run of consecutive winning weeks ever.
 */
export function recomputeStats(
  player: PlayerRecord,
  currentWeek: string,
): PlayerRecord {
  const weeks = player.weeks;
  const completed = Object.entries(weeks).filter(
    ([, w]) => w.result === "win" || w.result === "loss",
  );

  const totalPlayed = completed.length;
  const totalWins = completed.filter(([, w]) => w.result === "win").length;

  // Current streak: walk backwards from the current week.
  let cursor = currentWeek;
  const cur = weeks[cursor];
  if (!cur || cur.result === "in_progress") {
    // The current week isn't decided yet — don't let it reset a prior streak.
    cursor = previousIsoWeek(cursor);
  }
  let currentStreak = 0;
  while (weeks[cursor] && weeks[cursor].result === "win") {
    currentStreak += 1;
    cursor = previousIsoWeek(cursor);
  }

  // Best streak: longest consecutive run of wins across all recorded weeks.
  const winWeeks = completed
    .filter(([, w]) => w.result === "win")
    .map(([wk]) => wk)
    .sort();
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const wk of winWeeks) {
    if (prev && areConsecutive(prev, wk)) run += 1;
    else run = 1;
    if (run > bestStreak) bestStreak = run;
    prev = wk;
  }
  bestStreak = Math.max(bestStreak, currentStreak, player.bestStreak || 0);

  return {
    ...player,
    currentStreak,
    bestStreak,
    totalWins,
    totalPlayed,
  };
}
