"use client";

import { useState } from "react";

type Status = "idle" | "working" | "done" | "error";

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function doReset() {
    setStatus("working");
    setMessage("");
    try {
      const res = await fetch("/api/wordle/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || "Something went wrong.");
      } else {
        setStatus("done");
        setMessage(data.message || "All game data cleared.");
        setSecret("");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="wl-page">
      <div className="wl-head">
        <h1>Admin</h1>
        <p className="wl-sub">Reset all EMJ Wordle data</p>
      </div>

      <div className="card">
        <p className="muted" style={{ marginBottom: "1.1rem" }}>
          This clears every player, every streak, and the leaderboard. It
          cannot be undone.
        </p>

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

        {!confirming ? (
          <button
            className="btn btn-primary mt"
            disabled={!secret || status === "working"}
            onClick={() => setConfirming(true)}
          >
            Reset all data
          </button>
        ) : (
          <div className="mt">
            <p className="error-text" style={{ marginBottom: "0.6rem" }}>
              Are you sure? This wipes all game data for everyone.
            </p>
            <div className="row">
              <button
                className="btn btn-primary"
                disabled={status === "working"}
                onClick={doReset}
              >
                {status === "working" ? "Resetting..." : "Yes, reset everything"}
              </button>
              <button
                className="btn"
                disabled={status === "working"}
                onClick={() => setConfirming(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className={status === "error" ? "error-text mt" : "notice mt"}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
