import { NextResponse } from "next/server";
import { resetAll } from "@/lib/wordle/store";

export const dynamic = "force-dynamic";

// Length-independent-ish constant-time comparison so a wrong password can't be
// guessed by timing the response.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Admin-only: clears all game data. Requires the WORDLE_ADMIN_SECRET password.
// Fails closed — if no secret is configured on the server, the endpoint is off.
export async function POST(req: Request) {
  const secret = process.env.WORDLE_ADMIN_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Reset is not configured on the server." },
      { status: 503 },
    );
  }

  let provided = "";
  try {
    const body = await req.json();
    provided = String(body?.secret || "");
  } catch {
    provided = "";
  }
  const candidate = provided || req.headers.get("x-admin-secret") || "";

  if (!candidate || !safeEqual(candidate, secret)) {
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
