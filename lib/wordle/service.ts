// Server-side glue between the store, the word source, and the game rules.
// Produces the client-facing state, which deliberately NEVER includes the
// current week's answer (guesses are scored server-side in the guess route).

import { currentIsoWeek, previousIsoWeek, weekLabel } from "./week";
import { getWordForWeek } from "./words";
import { getPlayer } from "./store";
import { MAX_GUESSES, WORD_LENGTH, scoreBoard } from "./game";
import type { PlayerRecord, ScoredGuess } from "./types";

export interface PlayerView {
  name: string;
  email: string;
  status: "in_progress" | "win" | "loss";
  locked: boolean;
  rows: ScoredGuess[];
  guessesUsed: number;
  currentStreak: number;
  bestStreak: number;
  totalWins: number;
  totalPlayed: number;
}

export interface WordleState {
  week: string;
  weekLabel: string;
  wordLength: number;
  maxGuesses: number;
  hasWord: boolean;
  noWordMessage?: string;
  previousWord: string | null;
  player: PlayerView | null;
  /** This week's answer — only populated once the player has locked the week. */
  revealedAnswer: string | null;
}

const NO_WORD_MESSAGE = "No word this week — check back soon.";

export function toPlayerView(
  player: PlayerRecord,
  week: string,
  answer: string | null,
): PlayerView {
  const wk = player.weeks[week];
  const status = wk?.result ?? "in_progress";
  const board = wk?.board ?? [];
  const rows = answer ? scoreBoard(board, answer) : [];
  return {
    name: player.name,
    email: player.email,
    status,
    locked: status === "win" || status === "loss",
    rows,
    guessesUsed: board.length,
    currentStreak: player.currentStreak,
    bestStreak: player.bestStreak,
    totalWins: player.totalWins,
    totalPlayed: player.totalPlayed,
  };
}

export async function buildState(email?: string | null): Promise<WordleState> {
  const week = currentIsoWeek();
  const [answer, previousWord] = await Promise.all([
    getWordForWeek(week),
    getWordForWeek(previousIsoWeek(week)),
  ]);

  let player: PlayerView | null = null;
  if (email) {
    const record = await getPlayer(email);
    if (record) player = toPlayerView(record, week, answer);
  }

  return {
    week,
    weekLabel: weekLabel(week),
    wordLength: WORD_LENGTH,
    maxGuesses: MAX_GUESSES,
    hasWord: Boolean(answer),
    noWordMessage: answer ? undefined : NO_WORD_MESSAGE,
    previousWord: previousWord ?? null,
    player,
    revealedAnswer: player?.locked ? answer : null,
  };
}
