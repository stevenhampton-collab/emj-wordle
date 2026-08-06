import { NextResponse } from "next/server";
import { resetAll } from "@/lib/wordle/store";
import { readSecret, verifyAdminSecret } from "@/lib/wordle/admin";

export const dynamic = "force-dynamic";

// Admin-only: clears all game data. Requires the WORDLE_ADMIN_SECRET password.
// Fails closed — if no secret is configured on the server, the endpoint is off.
export async function POST(req: Request) {
  const { configured, ok } = verifyAdminSecret(await readSecret(req));
  if (!configured) {
    return NextResponse.json(
      { error: "Reset is not configured on the server." },
      { status: 503 },
    );
  }
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  try {
    await resetAll();
    return NextResponse.json({ ok: true, message: "All game data cleared." });
  } catch (err) {
    console.error("wordle reset failed:", err);
    return NextResponse.json(
      { error: "Reset failed. Please try again." },
      { status: 500 },
    );
  }
}
