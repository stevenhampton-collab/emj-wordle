import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/wordle/store";
import type { LeaderboardEntry } from "@/lib/wordle/types";

export const dynamic = "force-dynamic";

// Minimum weeks played to appear in the win-percentage ranking, so a single
// win doesn't show as 100%.
const MIN_WEEKS_FOR_WIN_PCT = 3;

// Public read-only leaderboard endpoint. Built to be called externally too
// (e.g. the Phase 2 Monday Slack message), hence the permissive CORS header.
const CORS = { "Access-Control-Allow-Origin": "*" } as const;

export function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: { ...CORS, "Access-Control-Allow-Methods": "GET, OPTIONS" },
  });
}

export async function GET() {
  try {
    const entries = await getLeaderboard();

    const streak = [...entries].sort(
      (a, b) =>
        b.currentStreak - a.currentStreak ||
        b.bestStreak - a.bestStreak ||
        a.name.localeCompare(b.name),
    );

    const topWinPct = entries
      .filter((e) => e.totalPlayed >= MIN_WEEKS_FOR_WIN_PCT)
      .map((e) => ({
        name: e.name,
        email: e.email,
        wins: e.totalWins,
        played: e.totalPlayed,
        winPct: e.totalPlayed > 0 ? e.totalWins / e.totalPlayed : 0,
      }))
      .sort((a, b) => b.winPct - a.winPct || b.wins - a.wins)
      .slice(0, 5);

    const streakView = streak.map((e: LeaderboardEntry) => ({
      name: e.name,
      currentStreak: e.currentStreak,
      bestStreak: e.bestStreak,
      totalPlayed: e.totalPlayed,
    }));

    return NextResponse.json(
      { streak: streakView, topWinPct },
      { headers: CORS },
    );
  } catch (err) {
    console.error("wordle leaderboard failed:", err);
    return NextResponse.json(
      { error: "Something went wrong loading the leaderboard." },
      { status: 500, headers: CORS },
    );
  }
}
