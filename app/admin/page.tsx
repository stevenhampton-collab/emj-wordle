"use client";

import { useState } from "react";

type Status = "idle" | "working" | "done" | "error";

interface Entry {
  email: string;
  name: string;
  currentStreak: number;
  bestStreak: number;
  totalWins: number;
  totalPlayed: number;
}

export default function AdminPage() {
  const [secret, setSecret] = useState("");

  // Player list + delete
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [listStatus, setListStatus] = useState<Status>("idle");
  const [listMessage, setListMessage] = useState("");
  const [manualEmail, setManualEmail] = useState("");

  // Reset all
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetStatus, setResetStatus] = useState<Status>("idle");
  const [resetMessage, setResetMessage] = useState("");

  async function loadPlayers() {
    setListStatus("working");
    setListMessage("");
    try {
      const res = await fetch("/api/wordle/admin/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setListStatus("error");
        setListMessage(data.error || "Could not load players.");
        setEntries(null);
      } else {
        setListStatus("done");
        setEntries(data.entries || []);
      }
    } catch {
      setListStatus("error");
      setListMessage("Network error. Please try again.");
    }
  }

  async function deleteEmail(email: string) {
    const target = email.trim();
    if (!target) return;
    if (!window.confirm(`Delete ${target}? This cannot be undone.`)) return;
    setListStatus("working");
    setListMessage("");
    try {
      const res = await fetch("/api/wordle/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, email: target }),
      });
      const data = await res.json();
      if (!res.ok) {
        setListStatus("error");
        setListMessage(data.error || "Could not delete that entry.");
      } else {
        setListMessage(data.message || `Deleted ${target}.`);
        setManualEmail("");
        await loadPlayers();
      }
    } catch {
      setListStatus("error");
      setListMessage("Network error. Please try again.");
    }
  }

  async function doReset() {
    setResetStatus("working");
    setResetMessage("");
    try {
      const res = await fetch("/api/wordle/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResetStatus("error");
        setResetMessage(data.error || "Something went wrong.");
      } else {
        setResetStatus("done");
        setResetMessage(data.message || "All game data cleared.");
        setEntries(null);
      }
    } catch {
      setResetStatus("error");
      setResetMessage("Network error. Please try again.");
    } finally {
      setConfirmingReset(false);
    }
  }

  return (
    <div className="wl-page">
      <div className="wl-head">
        <h1>Admin</h1>
        <p className="wl-sub">Manage EMJ Wordle data</p>
      </div>

      {/* Password */}
      <div className="card">
        <label className="field-label" htmlFor="secret">
          Admin password
        </label>
        <input
          id="secret"
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="Enter admin password"
          autoComplete="off"
        />
        <p className="muted mt-sm" style={{ fontSize: "0.85rem" }}>
          Required for every action below.
        </p>
      </div>

      {/* Delete specific entries */}
      <div className="card mt">
        <p className="question-text">Delete a specific player</p>
        <p className="question-hint">
          Load the current players and remove any one of them, or delete by
          email.
        </p>

        <button
          className="btn"
          disabled={!secret || listStatus === "working"}
          onClick={loadPlayers}
        >
          {listStatus === "working" ? "Working..." : "Load players"}
        </button>

        {entries && entries.length > 0 && (
          <div className="table-wrap mt">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Wins</th>
                  <th>Streak</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.email}>
                    <td>{e.name}</td>
                    <td>{e.email}</td>
                    <td>{e.totalWins}</td>
                    <td>{e.currentStreak}</td>
                    <td>
                      <button
                        className="btn btn-sm"
                        disabled={listStatus === "working"}
                        onClick={() => deleteEmail(e.email)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {entries && entries.length === 0 && (
          <p className="muted mt">No players on the leaderboard yet.</p>
        )}

        <div className="mt">
          <label className="field-label" htmlFor="manualEmail">
            Delete by email
          </label>
          <div className="row">
            <input
              id="manualEmail"
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="name@everymanjack.com"
              autoComplete="off"
            />
            <button
              className="btn"
              style={{ flex: "0 0 auto" }}
              disabled={!secret || !manualEmail || listStatus === "working"}
              onClick={() => deleteEmail(manualEmail)}
            >
              Delete
            </button>
          </div>
          <p className="muted mt-sm" style={{ fontSize: "0.85rem" }}>
            Useful for someone mid-game who hasn&apos;t finished a week (they
            won&apos;t appear in the list above).
          </p>
        </div>

        {listMessage && (
          <p className={listStatus === "error" ? "error-text mt" : "notice mt"}>
            {listMessage}
          </p>
        )}
      </div>

      {/* Reset everything */}
      <div className="card mt">
        <p className="question-text">Reset all data</p>
        <p className="question-hint">
          Clears every player, every streak, and the leaderboard. It cannot be
          undone.
        </p>

        {!confirmingReset ? (
          <button
            className="btn btn-primary"
            disabled={!secret || resetStatus === "working"}
            onClick={() => setConfirmingReset(true)}
          >
            Reset all data
          </button>
        ) : (
          <div>
            <p className="error-text" style={{ marginBottom: "0.6rem" }}>
              Are you sure? This wipes all game data for everyone.
            </p>
            <div className="row">
              <button
                className="btn btn-primary"
                style={{ flex: "0 0 auto" }}
                disabled={resetStatus === "working"}
                onClick={doReset}
              >
                {resetStatus === "working"
                  ? "Resetting..."
                  : "Yes, reset everything"}
              </button>
              <button
                className="btn"
                style={{ flex: "0 0 auto" }}
                disabled={resetStatus === "working"}
                onClick={() => setConfirmingReset(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {resetMessage && (
          <p className={resetStatus === "error" ? "error-text mt" : "notice mt"}>
            {resetMessage}
          </p>
        )}
      </div>
    </div>
  );
}
