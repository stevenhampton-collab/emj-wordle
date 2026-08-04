"use client";

import { useCallback, useEffect, useState } from "react";
import type { WordleState } from "@/lib/wordle/service";
import type { TileState } from "@/lib/wordle/types";

const STORAGE_KEY = "emj_wordle_identity";
const MAX_GUESSES = 6;
const WORD_LENGTH = 5;

interface Identity {
  firstName: string;
  lastName: string;
  email: string;
  name: string;
}

interface StreakRow {
  name: string;
  currentStreak: number;
  bestStreak: number;
  totalPlayed: number;
}
interface WinRow {
  name: string;
  wins: number;
  played: number;
  winPct: number;
}
interface Leaderboard {
  streak: StreakRow[];
  topWinPct: WinRow[];
}

const KEY_ROWS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];

export default function WordleClient() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [state, setState] = useState<WordleState | null>(null);
  const [leaderboard, setLeaderboard] = useState<Leaderboard | null>(null);
  const [currentGuess, setCurrentGuess] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [booting, setBooting] = useState(true);

  const player = state?.player ?? null;
  const locked = player?.locked ?? false;
  const hasWord = state?.hasWord ?? false;
  const revealed = state?.revealedAnswer ?? null;

  const loadLeaderboard = useCallback(async () => {
    try {
      const res = await fetch("/api/wordle/leaderboard", { cache: "no-store" });
      if (res.ok) setLeaderboard(await res.json());
    } catch {
      /* leaderboard is non-critical */
    }
  }, []);

  // Reconnect an existing player (from localStorage) and load state.
  const reconnect = useCallback(
    async (id: Identity) => {
      try {
        const res = await fetch("/api/wordle/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id),
        });
        const data = await res.json();
        if (res.ok) {
          setState(data as WordleState);
        } else {
          setMessage(data.error || "Something went wrong.");
        }
      } catch {
        setMessage("Couldn't reach the server. Please refresh.");
      }
    },
    [],
  );

  // On first load: restore identity and boot the game.
  useEffect(() => {
    let stored: Identity | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) stored = JSON.parse(raw) as Identity;
    } catch {
      /* ignore */
    }
    (async () => {
      if (stored?.email) {
        setIdentity(stored);
        await reconnect(stored);
      }
      await loadLeaderboard();
      setBooting(false);
    })();
  }, [reconnect, loadLeaderboard]);

  const submitGuess = useCallback(async () => {
    if (!identity || locked || !hasWord || submitting) return;
    if (currentGuess.length !== WORD_LENGTH) {
      setMessage("Not enough letters.");
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/wordle/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identity.email, guess: currentGuess }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "That guess didn't work.");
      } else {
        setState(data as WordleState);
        setCurrentGuess("");
        if (data.player?.locked) loadLeaderboard();
      }
    } catch {
      setMessage("Couldn't reach the server. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [identity, locked, hasWord, submitting, currentGuess, loadLeaderboard]);

  const handleKey = useCallback(
    (key: string) => {
      if (locked || !hasWord || submitting) return;
      if (key === "ENTER") {
        void submitGuess();
      } else if (key === "BACK") {
        setCurrentGuess((g) => g.slice(0, -1));
      } else if (/^[A-Z]$/.test(key)) {
        setCurrentGuess((g) => (g.length < WORD_LENGTH ? g + key : g));
      }
    },
    [locked, hasWord, submitting, submitGuess],
  );

  // Physical keyboard support.
  useEffect(() => {
    if (!identity) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "Enter") handleKey("ENTER");
      else if (e.key === "Backspace") handleKey("BACK");
      else if (/^[a-zA-Z]$/.test(e.key)) handleKey(e.key.toUpperCase());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [identity, handleKey]);

  function onRegister(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const firstName = (form.elements.namedItem("firstName") as HTMLInputElement).value.trim();
    const lastName = (form.elements.namedItem("lastName") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    if (!firstName || !lastName || !email) {
      setMessage("Please fill in all fields.");
      return;
    }
    const id: Identity = { firstName, lastName, email, name: `${firstName} ${lastName}` };
    setMessage(null);
    (async () => {
      try {
        const res = await fetch("/api/wordle/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(id),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Couldn't save your details.");
          return;
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(id));
        setIdentity(id);
        setState(data as WordleState);
        loadLeaderboard();
      } catch {
        setMessage("Couldn't reach the server. Please try again.");
      }
    })();
  }

  function switchPlayer() {
    localStorage.removeItem(STORAGE_KEY);
    setIdentity(null);
    setState(null);
    setCurrentGuess("");
    setMessage(null);
  }

  // ---- Derived: keyboard letter states from submitted rows ----
  const keyStates: Record<string, TileState> = {};
  if (player) {
    const rank: Record<TileState, number> = { absent: 0, present: 1, correct: 2 };
    for (const row of player.rows) {
      row.guess.split("").forEach((ch, i) => {
        const s = row.tiles[i];
        if (!keyStates[ch] || rank[s] > rank[keyStates[ch]]) keyStates[ch] = s;
      });
    }
  }

  // ---- Render ----
  if (booting) {
    return (
      <div className="wl-page">
        <div className="wl-head">
          <h1>EMJ Wordle</h1>
        </div>
        <p className="center muted">Loading…</p>
      </div>
    );
  }

  return (
    <div className="wl-page">
      <div className="wl-head">
        <h1>EMJ Wordle</h1>
        <p className="wl-sub">
          {state ? `${state.weekLabel} — Good luck.` : "One word a week. Keep the streak alive."}
        </p>
      </div>

      {!identity ? (
        <IdentityGate onRegister={onRegister} message={message} />
      ) : (
        <>
          {message && <div className="wl-msg error-text">{message}</div>}

          {!hasWord ? (
            <div className="notice warn center">
              {state?.noWordMessage || "No word this week — check back soon."}
            </div>
          ) : (
            <>
              <Board
                rows={player?.rows ?? []}
                currentGuess={currentGuess}
                locked={locked}
              />

              {locked && (
                <p className={`wl-flavor ${player?.status === "win" ? "win" : "loss"}`}>
                  {player?.status === "win"
                    ? `Nailed it in ${player.guessesUsed} ${player.guessesUsed === 1 ? "guess" : "guesses"}. Back Monday for a fresh word.`
                    : `Out of guesses.${revealed ? ` The word was ${revealed}.` : ""} Back Monday for a fresh word.`}
                </p>
              )}

              {!locked && (
                <Keyboard keyStates={keyStates} onKey={handleKey} disabled={submitting} />
              )}
            </>
          )}

          {state?.previousWord && (
            <p className="wl-prev">
              Last week&rsquo;s word: <strong>{state.previousWord}</strong>
            </p>
          )}

          {player && (
            <div className="wl-you">
              <span>
                Playing as <strong>{player.name}</strong>
              </span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={switchPlayer}>
                Not you?
              </button>
            </div>
          )}
        </>
      )}

      <LeaderboardTables data={leaderboard} />
    </div>
  );
}

function IdentityGate({
  onRegister,
  message,
}: {
  onRegister: (e: React.FormEvent<HTMLFormElement>) => void;
  message: string | null;
}) {
  return (
    <div className="wl-gate card">
      <p className="question-text">Let&rsquo;s get you set up</p>
      <p className="question-hint">
        Enter your name and EMJ email so we can track your streak. We&rsquo;ll
        remember you on this device.
      </p>
      <form onSubmit={onRegister}>
        <div className="field row">
          <div>
            <label className="field-label" htmlFor="firstName">
              First name
            </label>
            <input id="firstName" name="firstName" type="text" autoComplete="given-name" required />
          </div>
          <div>
            <label className="field-label" htmlFor="lastName">
              Last name
            </label>
            <input id="lastName" name="lastName" type="text" autoComplete="family-name" required />
          </div>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="email">
            EMJ email
          </label>
          <input id="email" name="email" type="email" autoComplete="email" placeholder="you@everymanjack.com" required />
        </div>
        {message && <div className="error-text mt-sm">{message}</div>}
        <button type="submit" className="btn btn-primary btn-lg mt" style={{ width: "100%" }}>
          Start playing
        </button>
      </form>
    </div>
  );
}

function Board({
  rows,
  currentGuess,
  locked,
}: {
  rows: { guess: string; tiles: TileState[] }[];
  currentGuess: string;
  locked: boolean;
}) {
  const inputRowIndex = rows.length;
  return (
    <div className="wl-board" aria-label="Guess board">
      {Array.from({ length: MAX_GUESSES }).map((_, r) => {
        const scored = rows[r];
        const isInput = r === inputRowIndex && !locked;
        return (
          <div className="wl-row" key={r}>
            {Array.from({ length: WORD_LENGTH }).map((__, c) => {
              if (scored) {
                return (
                  <div key={c} className={`wl-tile wl-${scored.tiles[c]}`}>
                    {scored.guess[c]}
                  </div>
                );
              }
              if (isInput) {
                const ch = currentGuess[c] || "";
                return (
                  <div key={c} className={`wl-tile ${ch ? "wl-filled" : ""}`}>
                    {ch}
                  </div>
                );
              }
              return <div key={c} className="wl-tile" />;
            })}
          </div>
        );
      })}
    </div>
  );
}

function Keyboard({
  keyStates,
  onKey,
  disabled,
}: {
  keyStates: Record<string, TileState>;
  onKey: (key: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="wl-keyboard">
      {KEY_ROWS.map((row, i) => (
        <div className="wl-krow" key={i}>
          {i === 2 && (
            <button
              type="button"
              className="wl-key wl-key-wide wl-enter"
              onClick={() => onKey("ENTER")}
              disabled={disabled}
            >
              Enter
            </button>
          )}
          {row.split("").map((ch) => (
            <button
              type="button"
              key={ch}
              className={`wl-key ${keyStates[ch] ? `wl-${keyStates[ch]}` : ""}`}
              onClick={() => onKey(ch)}
              disabled={disabled}
            >
              {ch}
            </button>
          ))}
          {i === 2 && (
            <button
              type="button"
              className="wl-key wl-key-wide wl-back"
              onClick={() => onKey("BACK")}
              disabled={disabled}
              aria-label="Delete"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 4H8l-7 8 7 8h13a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1Z" />
                <path d="m18 9-6 6" />
                <path d="m12 9 6 6" />
              </svg>
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function LeaderboardTables({ data }: { data: Leaderboard | null }) {
  const hasStreak = data && data.streak.length > 0;
  const hasWin = data && data.topWinPct.length > 0;
  return (
    <>
      <hr className="hr" />
      <h2 className="wl-lb-title">Streak leaderboard</h2>
      {hasStreak ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Current</th>
                <th>Best</th>
                <th>Played</th>
              </tr>
            </thead>
            <tbody>
              {data!.streak.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{r.currentStreak}</td>
                  <td>{r.bestStreak}</td>
                  <td>{r.totalPlayed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No results yet — be the first to play.</p>
      )}

      <h2 className="wl-lb-title">Top 5 — win percentage</h2>
      {hasWin ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Win %</th>
                <th>Wins</th>
              </tr>
            </thead>
            <tbody>
              {data!.topWinPct.map((r, i) => (
                <tr key={i}>
                  <td>{r.name}</td>
                  <td>{Math.round(r.winPct * 100)}%</td>
                  <td>{r.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">
          Win percentage appears once players have completed at least three weeks.
        </p>
      )}
    </>
  );
}
