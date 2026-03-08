import { useEffect, useMemo, useState } from "react";

import { listLibrary, listProjects } from "../api/client";
import { getModelLabel, getTaskLabel, type Prompt, type Project } from "../types";

export function LibraryPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedPromptId, setCopiedPromptId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setErrorMessage(null);
      try {
        const [libraryItems, projectItems] = await Promise.all([
          listLibrary(),
          listProjects(),
        ]);
        if (cancelled) {
          return;
        }
        setPrompts(libraryItems);
        setProjects(projectItems);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load library.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredPrompts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return prompts;
    }

    return prompts.filter((prompt) =>
      [
        prompt.title,
        prompt.rough_intent,
        prompt.why_it_works,
        prompt.task_type,
        prompt.target_model,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(normalizedQuery)),
    );
  }, [prompts, query]);

  const ratedCount = useMemo(
    () => prompts.filter((prompt) => prompt.effectiveness_rating !== null).length,
    [prompts],
  );

  function getProjectName(projectId: string) {
    return projects.find((project) => project.id === projectId)?.name ?? "Unknown project";
  }

  async function handleCopy(prompt: Prompt) {
    try {
      await navigator.clipboard.writeText(prompt.compiled_prompt);
      setCopiedPromptId(prompt.id);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to copy the prompt.");
    }
  }

  return (
    <section className="grid gap-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid gap-3">
          <p className="eyebrow">Library</p>
          <h2 className="page-title">Keep the prompts worth repeating</h2>
          <p className="page-description">
            Browse saved prompts, why-notes, and model-task pairings so the library
            becomes an operating memory instead of a clipboard graveyard.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[24rem]">
          <div className="panel-subtle">
            <p className="field-label">Saved</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-900">
              {prompts.length}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-700">Prompt artifacts in the library.</p>
          </div>
          <div className="panel-subtle">
            <p className="field-label">Rated</p>
            <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-ink-900">
              {ratedCount}
            </p>
            <p className="mt-1 text-sm leading-6 text-ink-700">Entries with effectiveness feedback.</p>
          </div>
        </div>
      </div>

      <section className="panel grid gap-4 p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <label className="grid flex-1 gap-2">
            <span className="field-label">Search library</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title, intent, why note, task, or model"
              className="field-input"
            />
          </label>

          <div className="panel-subtle grid gap-1 xl:min-w-[16rem]">
            <span className="field-label">Results</span>
            <strong className="text-2xl font-semibold tracking-[-0.04em] text-ink-900">
              {loading ? "..." : filteredPrompts.length}
            </strong>
            <span className="text-sm leading-6 text-ink-700">
              Matching prompt entries.
            </span>
          </div>
        </div>

        {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
      </section>

      {loading ? (
        <section className="panel p-6">
          <p className="text-sm leading-6 text-ink-700">Loading saved prompts...</p>
        </section>
      ) : filteredPrompts.length === 0 ? (
        <section className="panel p-6">
          <p className="text-sm leading-6 text-ink-700">
            No saved prompts yet. Compile one in the workbench and save it with a
            rating and a why-it-worked note.
          </p>
        </section>
      ) : (
        <div className="grid gap-5">
          {filteredPrompts.map((prompt) => (
            <article
              key={prompt.id}
              className="panel grid gap-5 p-6 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]"
            >
              <div className="grid gap-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="grid gap-3">
                    <h3 className="text-[1.35rem] font-semibold leading-tight tracking-[-0.03em] text-ink-900">
                      {prompt.title || prompt.rough_intent}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      <span className="badge badge-muted">
                        {getTaskLabel(prompt.task_type)}
                      </span>
                      <span className="badge badge-muted">
                        {getModelLabel(prompt.target_model)}
                      </span>
                      <span className="badge badge-accent">
                        {getProjectName(prompt.project_id)}
                      </span>
                      {prompt.effectiveness_rating ? (
                        <span className="badge badge-success">
                          {prompt.effectiveness_rating}/5
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void handleCopy(prompt)}
                  >
                    {copiedPromptId === prompt.id ? "Copied" : "Copy prompt"}
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="panel-subtle grid gap-2">
                    <p className="field-label">Rough intent</p>
                    <p className="text-sm leading-6 text-ink-900">{prompt.rough_intent}</p>
                  </div>
                  <div className="panel-subtle grid gap-2">
                    <p className="field-label">Why this worked</p>
                    <p className="text-sm leading-6 text-ink-900">{prompt.why_it_works}</p>
                  </div>
                </div>

                <p className="text-xs uppercase tracking-[0.16em] text-ink-700">
                  Saved {new Date(prompt.created_at).toLocaleString()}
                </p>
              </div>

              <div className="grid min-w-0 gap-3">
                <p className="field-label">Compiled prompt</p>
                <pre className="code-block">{prompt.compiled_prompt}</pre>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default LibraryPage;
