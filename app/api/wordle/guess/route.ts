import { NextResponse } from "next/server";
import { currentIsoWeek } from "@/lib/wordle/week";
import { getWordForWeek } from "@/lib/wordle/words";
import {
  getPlayer,
  savePlayer,
  upsertLeaderboardEntry,
} from "@/lib/wordle/store";
import { MAX_GUESSES, WORD_LENGTH, recomputeStats } from "@/lib/wordle/game";
import { buildState } from "@/lib/wordle/service";
import type { WeekRecord } from "@/lib/wordle/types";

export const dynamic = "force-dynamic";

// Submit one guess. The answer stays server-side: we score here, persist
// progress, and lock the week on a win or the 6th guess.
export async function POST(req: Request) {
  let email = "";
  let guess = "";
  try {
    const body = await req.json();
    email = String(body.email || "").trim();
    guess = String(body.guess || "").trim().toUpperCase();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!email) {
    return NextResponse.json(
      { error: "Please enter your details before playing." },
      { status: 400 },
    );
  }
  if (!new RegExp(`^[A-Z]{${WORD_LENGTH}}$`).test(guess)) {
    return NextResponse.json(
      { error: `Guess must be ${WORD_LENGTH} letters.` },
      { status: 400 },
    );
  }

  const week = currentIsoWeek();
  const answer = await getWordForWeek(week);
  if (!answer) {
    return NextResponse.json(
      { error: "No word this week — check back soon." },
      { status: 400 },
    );
  }

  const player = await getPlayer(email);
  if (!player) {
    return NextResponse.json(
      { error: "We couldn't find your player record. Please re-enter your details." },
      { status: 404 },
    );
  }

  const existing: WeekRecord = player.weeks[week] ?? {
    result: "in_progress",
    guesses: 0,
    board: [],
  };

  if (existing.result === "win" || existing.result === "loss") {
    return NextResponse.json(
      { error: "You've already played this week. Come back Monday for a new word." },
      { status: 409 },
    );
  }
  if (existing.board.length >= MAX_GUESSES) {
    return NextResponse.json(
      { error: "No guesses left this week." },
      { status: 409 },
    );
  }

  // Record the guess.
  existing.board = [...existing.board, guess];
  existing.guesses = existing.board.length;

  const won = guess === answer;
  const lost = !won && existing.board.length >= MAX_GUESSES;
  if (won) existing.result = "win";
  else if (lost) existing.result = "loss";
  else existing.result = "in_progress";

  player.weeks[week] = existing;

  let updated = player;
  if (won || lost) {
    updated = recomputeStats(player, week);
    await upsertLeaderboardEntry({
      email: updated.email,
      name: updated.name,
      currentStreak: updated.currentStreak,
      bestStreak: updated.bestStreak,
      totalWins: updated.totalWins,
      totalPlayed: updated.totalPlayed,
    });
  }

  try {
    await savePlayer(updated);
  } catch (err) {
    console.error("wordle guess save failed:", err);
    return NextResponse.json(
      { error: "Something went wrong saving your guess. Please try again." },
      { status: 500 },
    );
  }

  // buildState includes revealedAnswer once the week is locked (for a loss).
  const state = await buildState(email);
  return NextResponse.json(state);
}
