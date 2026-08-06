import { NextResponse } from "next/server";
import { deletePlayer } from "@/lib/wordle/store";
import { readSecret, verifyAdminSecret } from "@/lib/wordle/admin";

export const dynamic = "force-dynamic";

// Admin-only: delete a single player by email. Requires the WORDLE_ADMIN_SECRET
// password. Fails closed when no secret is configured on the server.
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

  let email = "";
  try {
    const body = await req.json();
    email = String(body?.email || "").trim();
  } catch {
    email = "";
  }
  if (!email) {
    return NextResponse.json(
      { error: "Please provide an email to delete." },
      { status: 400 },
    );
  }

  try {
    await deletePlayer(email);
    return NextResponse.json({ ok: true, message: `Deleted ${email}.` });
  } catch (err) {
    console.error("wordle delete failed:", err);
    return NextResponse.json(
      { error: "Delete failed. Please try again." },
      { status: 500 },
    );
  }
}
