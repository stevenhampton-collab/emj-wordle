import { NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/wordle/store";
import { readSecret, verifyAdminSecret } from "@/lib/wordle/admin";

export const dynamic = "force-dynamic";

// Admin-only: list the players currently on the leaderboard so specific entries
// can be picked for deletion. Requires the WORDLE_ADMIN_SECRET password.
export async function POST(req: Request) {
  const { configured, ok } = verifyAdminSecret(await readSecret(req));
  if (!configured) {
    return NextResponse.json(
      { error: "Admin is not configured on the server." },
      { status: 503 },
    );
  }
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const entries = await getLeaderboard();
  return NextResponse.json({ entries });
}
