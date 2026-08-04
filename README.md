# EMJ Wordle

A weekly, browser-based Wordle-style word game for the Every Man Jack team. One
new 5-letter word is published every Monday (12:00 AM Pacific); players have the
whole week to solve it in 6 guesses. Players are identified by their EMJ email,
and a shared leaderboard tracks weekly streaks and win percentage.

This is a **standalone Next.js app** — it deploys to its own Vercel project with
its own domain and its own database, independent of any other EMJ app.

## How it works

- **No login.** On first visit a player enters first name, last name, and EMJ
  email. That's saved in the browser so they aren't asked again on the same
  device; the email is the unique key that links their record across weeks and
  devices.
- **Fair play.** The week's answer stays on the server — guesses are scored
  server-side, so the answer is never sent to the browser until the game is over.
- **Weekly lock.** A win or a 6th-guess loss locks the game until next Monday.
- **Streaks.** A win increments the streak; a loss or a missed week resets it.
- **Leaderboard.** Streak table (all players) plus Top 5 by win percentage
  (minimum 3 weeks played to qualify).

## Tech stack

- **Next.js (App Router) + TypeScript** — deploys to Vercel with zero config.
- **Vercel KV** — stores players and the leaderboard (no SDK; plain REST).
- **Google Sheets** — the weekly word list (read-only API key; no SDK).

Both storage and the word list have built-in fallbacks, so the app runs before
they're configured (in-memory store + a starter word bank).

## Environment variables

Copy `.env.example` to `.env.local` for local dev, and set the same values in
Vercel (Project → Settings → Environment Variables). **Never commit secrets.**

| Variable               | Purpose                                                        |
| ---------------------- | -------------------------------------------------------------- |
| `KV_REST_API_URL`      | Vercel KV — auto-set when you attach a KV store in Vercel.     |
| `KV_REST_API_TOKEN`    | Vercel KV — auto-set when you attach a KV store in Vercel.     |
| `GOOGLE_SHEETS_ID`     | The word-list Google Sheet's ID (optional; falls back).        |
| `GOOGLE_SHEETS_API_KEY`| Read-only Google Sheets API key (optional; falls back).        |
| `GOOGLE_SHEETS_RANGE`  | Optional. Defaults to `A:B`.                                   |

## Local development

```bash
npm install
cp .env.example .env.local     # optional — the app runs without any of it
npm run dev                     # http://localhost:3000
```

Without KV set, scores are kept in memory and reset when the server restarts.
Without the Google Sheet set, the word comes from the built-in starter bank.

## Deploying to Vercel

1. **Connect the repo.** In Vercel, **Add New → Project**, import this
   repository. It auto-detects Next.js — no build settings needed. Deploy.
2. **Add KV.** Project → **Storage → Create Database → KV → Connect**. Vercel
   injects `KV_REST_API_URL` and `KV_REST_API_TOKEN` automatically. (Required in
   production, or scores won't persist.)
3. **Add the Google Sheet** (optional). Set `GOOGLE_SHEETS_ID` and
   `GOOGLE_SHEETS_API_KEY` in Environment Variables (see below).
4. **Add a domain.** Settings → **Domains** → add your domain (buy through Vercel
   or point an existing one with the DNS record Vercel shows). HTTPS is automatic.
5. **Play.** Visit your domain and complete a round to confirm KV is connected.

## Managing the word list (no coding required)

The word list lives in a Google Sheet so anyone on the team can update it:

1. Create a Google Sheet with two columns and a header row:

   | Week      | Word  |
   | --------- | ----- |
   | 2026-W32  | CEDAR |
   | 2026-W33  | BEARD |

   - **Week** is the ISO week in `YYYY-Www` format (e.g. `2026-W32`). Each ISO
     week runs Monday–Sunday. Add rows in bulk for the year if you like.
   - **Word** is a 5-letter word in UPPERCASE.
2. **Share → General access → "Anyone with the link" → Viewer.**
3. Copy the sheet ID from its URL — the long string between `/d/` and `/edit` —
   and set it as `GOOGLE_SHEETS_ID`. Set `GOOGLE_SHEETS_API_KEY` to a read-only
   Google Sheets API key (Google Cloud Console → APIs & Services → Credentials →
   Create API key; enable the "Google Sheets API").
4. Edit rows any time. If a week has no matching row, the game shows
   "No word this week — check back soon."

A starter word bank (EMJ/product, grooming, and outdoor themes) is included in
`lib/wordle/words.ts` — copy it into the sheet to get going.

## External leaderboard endpoint

`GET /api/wordle/leaderboard` returns the streak leaderboard and Top 5 win
percentage as JSON (CORS-enabled), for use by an external caller (e.g. a Monday
announcement). It requires no auth and exposes no answers.

## Project structure

```
app/
  layout.tsx                     app shell (header + logo)
  page.tsx                       the game (home page)
  WordleClient.tsx               board, keyboard, leaderboard (client)
  api/wordle/register            create/reconnect a player
  api/wordle/state               current week's state (no answer)
  api/wordle/guess               score a guess server-side; lock on completion
  api/wordle/leaderboard         public streak + win% leaderboard
lib/wordle/
  week.ts       Pacific ISO-week math
  words.ts      Google Sheets word source + starter bank fallback
  store.ts      Vercel KV over REST + in-memory fallback
  game.ts       guess scoring + streak/stats logic
  service.ts    builds client state (never leaks the answer)
  types.ts      shared types
```
