import { test, expect } from "@playwright/test";

// The API base URL the app uses
const API = "http://127.0.0.1:8000";

// Mock all API endpoints needed for the workbench to load
test.beforeEach(async ({ page }) => {
  // Mock projects list
  await page.route(`${API}/api/projects`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([
        {
          id: "proj-1",
          name: "_prompt_os",
          path: "/path/to/project",
          repo_map_path: null,
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
          last_mapped_at: null,
        },
      ]),
    }),
  );

  // Mock sessions/latest (no open session by default)
  await page.route(`${API}/api/sessions/latest`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "null",
    }),
  );

  // Mock session create (POST) and list (GET)
  await page.route(`${API}/api/sessions`, async (route) => {
    if (route.request().method() === "POST") {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "sess-1",
          title: "Test session",
          project_id: "proj-1",
          task_type: "refactor",
          rough_intent: null,
          reformulated_intent: null,
          clarify_rounds: [],
          compiled_versions: [],
          selected_model: "gpt-5.4",
          status: "open",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    }
  });

  // Mock session update (PUT /api/sessions/:id)
  await page.route(`${API}/api/sessions/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "sess-1",
        title: "Test session",
        project_id: "proj-1",
        task_type: "refactor",
        rough_intent: "test intent",
        reformulated_intent: null,
        clarify_rounds: [],
        compiled_versions: [],
        selected_model: "gpt-5.4",
        status: "open",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      }),
    }),
  );
});

test("workbench loads and shows context stage and intent stage titles", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Project & task type")).toBeVisible();
  await expect(page.getByText("Describe your intent")).toBeVisible();
});

test("context stage advances to intent on continue", async ({ page }) => {
  await page.goto("/");
  // The project select auto-selects the first project (proj-1), so the
  // "Continue to intent" button should be enabled.
  const continueBtn = page.getByRole("button", {
    name: "Continue to intent",
  });
  await expect(continueBtn).toBeEnabled();
  await continueBtn.click();
  // Intent stage should now be active — the textarea and its label appear
  await expect(page.getByText("What do you need done?")).toBeVisible();
});

test("task type selection shows refactor option", async ({ page }) => {
  await page.goto("/");
  // The context stage should show task type options — refactor is the default
  await expect(page.getByText("Refactor")).toBeVisible();
});

test("dark mode toggle switches theme attribute", async ({ page }) => {
  await page.goto("/");
  const html = page.locator("html");
  // ThemeSwitcher sets data-theme on the html element via useEffect on mount.
  // Wait for it to stabilise — the initial value depends on localStorage /
  // prefers-color-scheme which defaults to "light" in Playwright.
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-theme"),
  );
  const initialTheme = await html.getAttribute("data-theme");

  // Click the theme switcher (aria-label is "Switch to dark mode" when light)
  const themeBtn = page.getByRole("button", {
    name: /switch to (dark|light) mode/i,
  });
  await themeBtn.click();

  // Theme should have toggled
  const newTheme = await html.getAttribute("data-theme");
  expect(newTheme).not.toBe(initialTheme);
});

test("navigation switches to library page", async ({ page }) => {
  // Also mock /api/library since LibraryPage fetches it
  await page.route(`${API}/api/library`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
  await page.goto("/");
  // Click the Library nav item in the sidebar — use exact match to avoid
  // matching "Save to library" stage button
  await page
    .getByRole("button", { name: "Library", exact: true })
    .first()
    .click();
  // Library page shows this heading
  await expect(
    page.getByText("Keep the prompts worth repeating"),
  ).toBeVisible();
});

test("navigation returns to workbench from library", async ({ page }) => {
  await page.route(`${API}/api/library`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: "[]",
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Library", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Keep the prompts worth repeating"),
  ).toBeVisible();
  // Navigate back to workbench
  await page.getByRole("button", { name: "Workbench" }).click();
  await expect(page.getByText("Project & task type")).toBeVisible();
});
