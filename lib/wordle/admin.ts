// Shared authorization for the admin-only actions (reset, list, delete).
// The password lives only in the WORDLE_ADMIN_SECRET env var — never in code.

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

// Pull the supplied password from the JSON body's `secret` field or the
// x-admin-secret header.
export async function readSecret(req: Request): Promise<string> {
  let provided = "";
  try {
    const body = await req.clone().json();
    provided = String(body?.secret || "");
  } catch {
    provided = "";
  }
  return provided || req.headers.get("x-admin-secret") || "";
}

// Returns whether admin is configured on the server, and whether the supplied
// password is correct. Fails closed when no secret is set.
export function verifyAdminSecret(provided: string): {
  configured: boolean;
  ok: boolean;
} {
  const secret = process.env.WORDLE_ADMIN_SECRET;
  if (!secret) return { configured: false, ok: false };
  return {
    configured: true,
    ok: Boolean(provided) && safeEqual(provided, secret),
  };
}
