import { useMemo, useState } from "react";

import type { Session } from "../types";

interface SessionSidebarProps {
  sessions: Session[];
  latestOpenSession: Session | null;
  currentSession: Session | null;
  disabled?: boolean;
  busyAction?: "start" | "sync" | "note" | "close" | null;
  onStartSession: () => void;
  onResumeSession: (session: Session) => void;
  onSyncSession: () => void;
  onAddNote: (note: string) => Promise<void> | void;
  onCloseSession: () => void;
}

export function SessionSidebar({
  sessions,
  latestOpenSession,
  currentSession,
  disabled = false,
  busyAction = null,
  onStartSession,
  onResumeSession,
  onSyncSession,
  onAddNote,
  onCloseSession,
}: SessionSidebarProps) {
  const [noteBody, setNoteBody] = useState("");
  const recentSessions = useMemo(() => sessions.slice(0, 8), [sessions]);

  async function handleAddNote() {
    const trimmed = noteBody.trim();
    if (!trimmed) {
      return;
    }
    await onAddNote(trimmed);
    setNoteBody("");
  }

  return (
    <aside className="panel grid gap-5 p-5">
      <div className="grid gap-2">
        <p className="field-label">Session rail</p>
        <h3 className="section-title text-[1.3rem]">Track each iteration</h3>
        <p className="section-copy">
          Keep rough intent, notes, and compiled state close while you refine the
          prompt.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        <button
          type="button"
          className="btn btn-dark justify-start"
          onClick={onStartSession}
          disabled={disabled || busyAction !== null}
        >
          {busyAction === "start"
            ? "Starting..."
            : currentSession
              ? "Start new session"
              : "Start session"}
        </button>

        {currentSession ? (
          <>
            <button
              type="button"
              className="btn btn-secondary justify-start"
              onClick={onSyncSession}
              disabled={disabled || busyAction !== null}
            >
              {busyAction === "sync" ? "Saving..." : "Save session state"}
            </button>
            <button
              type="button"
              className="btn btn-muted justify-start"
              onClick={onCloseSession}
              disabled={disabled || busyAction !== null}
            >
              {busyAction === "close" ? "Closing..." : "Close session"}
            </button>
          </>
        ) : null}
      </div>

      {latestOpenSession && latestOpenSession.id !== currentSession?.id ? (
        <section className="panel-subtle grid gap-3">
          <span className="badge badge-accent">Resume latest</span>
          <div className="grid gap-1">
            <strong className="text-ink-900">
              {latestOpenSession.title || "Untitled session"}
            </strong>
            <p className="text-sm leading-6 text-ink-700">
              Updated {new Date(latestOpenSession.updated_at).toLocaleString()}
            </p>
          </div>
          <button
            type="button"
            className="btn btn-secondary w-fit"
            onClick={() => onResumeSession(latestOpenSession)}
            disabled={disabled || busyAction !== null}
          >
            Resume session
          </button>
        </section>
      ) : null}

      {currentSession ? (
        <section className="panel-subtle grid gap-4">
          <div className="grid gap-2">
            <span className="badge badge-success">Current session</span>
            <strong className="text-ink-900">
              {currentSession.title || "Untitled session"}
            </strong>
            <p className="text-sm leading-6 text-ink-700">
              Updated {new Date(currentSession.updated_at).toLocaleString()}
            </p>
          </div>

          <textarea
            value={noteBody}
            onChange={(event) => setNoteBody(event.target.value)}
            placeholder="Add a note about what you learned or what to try next"
            className="field-textarea min-h-32 bg-white"
            disabled={disabled || busyAction !== null}
          />

          <button
            type="button"
            className="btn btn-secondary w-fit"
            onClick={() => void handleAddNote()}
            disabled={disabled || busyAction !== null || !noteBody.trim()}
          >
            {busyAction === "note" ? "Saving note..." : "Add note"}
          </button>

          {currentSession.notes.length > 0 ? (
            <div className="grid gap-3">
              {currentSession.notes
                .slice()
                .reverse()
                .map((note) => (
                  <article
                    key={note.id}
                    className="rounded-[1rem] border border-black/10 bg-white px-4 py-3"
                  >
                    <p className="text-sm leading-6 text-ink-900">{note.body}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.16em] text-ink-700">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </article>
                ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-ink-700">No notes yet for this session.</p>
          )}
        </section>
      ) : null}

      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="section-title">Recent sessions</h3>
          <span className="text-xs uppercase tracking-[0.16em] text-ink-500">
            {recentSessions.length}
          </span>
        </div>

        {recentSessions.length === 0 ? (
          <p className="text-sm leading-6 text-ink-700">No saved sessions yet.</p>
        ) : (
          <div className="grid gap-3">
            {recentSessions.map((session) => (
              <article key={session.id} className="panel-subtle grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="text-ink-900">
                    {session.title || "Untitled session"}
                  </strong>
                  <span className={`badge ${session.status === "open" ? "badge-success" : "badge-muted"}`}>
                    {session.status}
                  </span>
                </div>
                <p className="text-sm leading-6 text-ink-700">
                  {session.rough_intent || "No rough intent saved yet."}
                </p>
                <button
                  type="button"
                  className="btn btn-secondary w-fit"
                  onClick={() => onResumeSession(session)}
                  disabled={disabled || busyAction !== null}
                >
                  Resume
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

export default SessionSidebar;
