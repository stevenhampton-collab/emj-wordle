import { NextResponse } from "next/server";
import { buildState } from "@/lib/wordle/service";

export const dynamic = "force-dynamic";

// Current week's game state for a player (or anonymous if no email given).
// Never returns the answer — only scored rows for guesses already made.
export async function GET(req: Request) {
  const email = new URL(req.url).searchParams.get("email");
  try {
    const state = await buildState(email);
    return NextResponse.json(state);
  } catch (err) {
    console.error("wordle state failed:", err);
    return NextResponse.json(
      { error: "Something went wrong loading the game." },
      { status: 500 },
    );
  }
}
