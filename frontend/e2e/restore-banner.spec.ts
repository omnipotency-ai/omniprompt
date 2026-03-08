import { test, expect } from "@playwright/test";

// The API base URL the app uses
const API = "http://127.0.0.1:8000";

// Session with a selected_model — restore will advance to "model" stage
const mockSessionWithModel = {
  id: "sess-existing",
  title: "Fix the auth flow",
  project_id: "proj-1",
  task_type: "refactor",
  rough_intent: "Fix the broken auth flow in the login page",
  reformulated_intent: null,
  clarify_rounds: [],
  compiled_versions: [],
  selected_model: "claude-sonnet-4-6",
  status: "open",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

// Session without a selected_model — restore will advance to "intent" stage
const mockSessionIntentOnly = {
  id: "sess-intent-only",
  title: "Fix the auth flow",
  project_id: "proj-1",
  task_type: "refactor",
  rough_intent: "Fix the broken auth flow in the login page",
  reformulated_intent: null,
  clarify_rounds: [],
  compiled_versions: [],
  selected_model: null,
  status: "open",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function mockCommonRoutes(
  page: import("@playwright/test").Page,
  sessionForLatest: object,
) {
  return Promise.all([
    page.route(`${API}/api/projects`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([
          {
            id: "proj-1",
            name: "_prompt_os",
            path: "/path",
            description: null,
            created_at: "2026-01-01T00:00:00Z",
          },
        ]),
      }),
    ),
    // Specific route for /sessions/latest — registered before the wildcard
    page.route(`${API}/api/sessions/latest`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionForLatest),
      }),
    ),
    // Wildcard for individual session operations (PUT /sessions/:id)
    page.route(`${API}/api/sessions/**`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionForLatest),
      }),
    ),
    // Session list and create
    page.route(`${API}/api/sessions`, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([sessionForLatest]),
      }),
    ),
  ]);
}

test("restore banner appears when an open session exists", async ({ page }) => {
  await mockCommonRoutes(page, mockSessionWithModel);
  await page.goto("/");
  // The banner text in Workbench.tsx is "Resume where you left off?"
  await expect(page.getByText("Resume where you left off?")).toBeVisible();
  // The session title appears below the prompt
  await expect(page.getByText("Fix the auth flow")).toBeVisible();
});

test("start fresh button dismisses the banner", async ({ page }) => {
  await mockCommonRoutes(page, mockSessionWithModel);
  await page.goto("/");
  await expect(page.getByText("Resume where you left off?")).toBeVisible();
  await page.getByRole("button", { name: "Start fresh" }).click();
  await expect(page.getByText("Resume where you left off?")).not.toBeVisible();
});

test("resume button restores session and advances to intent stage", async ({
  page,
}) => {
  // Use a session without selected_model so handleRestoreSession advances to "intent"
  await mockCommonRoutes(page, mockSessionIntentOnly);
  await page.goto("/");
  await expect(page.getByText("Resume where you left off?")).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  // The session has rough_intent but no clarify_rounds or selected_model,
  // so handleRestoreSession sets currentStage to "intent" (active = expanded).
  // The intent stage content area should be visible.
  await expect(page.getByText("What do you need done?")).toBeVisible();
  // Banner should be gone after resuming
  await expect(page.getByText("Resume where you left off?")).not.toBeVisible();
});
