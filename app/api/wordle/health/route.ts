import { NextResponse } from "next/server";
import { kvSelfTest } from "@/lib/wordle/store";

export const dynamic = "force-dynamic";

// Lightweight diagnostics endpoint: reports whether durable KV storage is
// connected and working. Never returns the secret URL or token.
export async function GET() {
  const result = await kvSelfTest();
  return NextResponse.json(result);
}
