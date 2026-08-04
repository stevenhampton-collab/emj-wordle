import { NextResponse } from "next/server";
import { getPlayer, savePlayer } from "@/lib/wordle/store";
import { buildState } from "@/lib/wordle/service";
import type { PlayerRecord } from "@/lib/wordle/types";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// First-visit identity capture. Creates the player's record (or reconnects to
// an existing one by email) and returns the current game state.
export async function POST(req: Request) {
  let firstName = "";
  let lastName = "";
  let email = "";
  try {
    const body = await req.json();
    firstName = String(body.firstName || "").trim();
    lastName = String(body.lastName || "").trim();
    email = String(body.email || "").trim();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (!firstName || !lastName) {
    return NextResponse.json(
      { error: "Please enter your first and last name." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 },
    );
  }

  const name = `${firstName} ${lastName}`;
  try {
    const existing = await getPlayer(email);
    if (existing) {
      // Reconnect: keep their history, refresh the display name.
      existing.name = name;
      existing.email = email;
      await savePlayer(existing);
    } else {
      const fresh: PlayerRecord = {
        email,
        name,
        weeks: {},
        currentStreak: 0,
        bestStreak: 0,
        totalWins: 0,
        totalPlayed: 0,
      };
      await savePlayer(fresh);
    }
    const state = await buildState(email);
    return NextResponse.json(state);
  } catch (err) {
    console.error("wordle register failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
