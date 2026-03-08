import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ContextStage } from "../ContextStage";
import type { Project, TaskType } from "../../../types";

const PROJECTS: Project[] = [
  {
    id: "p1",
    name: "Alpha",
    path: "/alpha",
    repo_map_path: null,
    created_at: "",
    updated_at: "",
    last_mapped_at: null,
  },
  {
    id: "p2",
    name: "Beta",
    path: "/beta",
    repo_map_path: null,
    created_at: "",
    updated_at: "",
    last_mapped_at: null,
  },
];

function renderContext(
  overrides: Partial<Parameters<typeof ContextStage>[0]> = {},
) {
  const defaults = {
    projects: PROJECTS,
    selectedProjectId: "",
    taskType: "refactor" as TaskType,
    onProjectChange: vi.fn(),
    onTaskTypeChange: vi.fn(),
    onContinue: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<ContextStage {...props} />), props };
}

describe("ContextStage", () => {
  it("renders project dropdown with projects", () => {
    renderContext();
    const select = screen.getByRole("combobox");
    expect(select).toBeInTheDocument();
    // Check options exist within the select
    const options = within(select).getAllByRole("option");
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain("Alpha");
    expect(optionTexts).toContain("Beta");
  });

  it("renders task type options", () => {
    renderContext();
    // Each task type has a button; getAllByRole to confirm there are 4 task buttons + 1 continue button
    const buttons = screen.getAllByRole("button");
    // 4 task type buttons + 1 "Continue to intent" button = 5
    expect(buttons.length).toBe(5);
    // Check text content of task buttons
    expect(screen.getByText("Refactor")).toBeInTheDocument();
    expect(screen.getByText("Frontend")).toBeInTheDocument();
    expect(screen.getByText("Audit")).toBeInTheDocument();
    expect(screen.getByText("Implement")).toBeInTheDocument();
  });

  it("calls onProjectChange when selecting a project", async () => {
    const user = userEvent.setup();
    const { props } = renderContext();

    await user.selectOptions(screen.getByRole("combobox"), "p2");
    expect(props.onProjectChange).toHaveBeenCalledWith("p2");
  });

  it("calls onTaskTypeChange when clicking a task type", async () => {
    const user = userEvent.setup();
    const { props } = renderContext();

    await user.click(screen.getByText("Audit"));
    expect(props.onTaskTypeChange).toHaveBeenCalledWith("audit");
  });

  it("shows task type description in accordion when expanded", async () => {
    const user = userEvent.setup();
    renderContext({ taskType: "refactor" });

    // Refactor is the default taskType so its accordion should be expanded initially
    expect(
      screen.getByText(
        "Restructure code without changing its intended behavior.",
      ),
    ).toBeInTheDocument();

    // Click Frontend to expand it
    await user.click(screen.getByText("Frontend"));
    expect(
      screen.getByText(
        "Change UI, layout, interactions, styling, or UX flows.",
      ),
    ).toBeInTheDocument();
  });

  it("calls onContinue when both project and task type are selected", async () => {
    const user = userEvent.setup();
    const { props } = renderContext({
      selectedProjectId: "p1",
      taskType: "refactor",
    });

    const continueButton = screen.getByRole("button", {
      name: /continue to intent/i,
    });
    expect(continueButton).not.toBeDisabled();
    await user.click(continueButton);
    expect(props.onContinue).toHaveBeenCalledOnce();
  });

  it("disables continue button when no project selected", () => {
    renderContext({ selectedProjectId: "" });
    const continueButton = screen.getByRole("button", {
      name: /continue to intent/i,
    });
    expect(continueButton).toBeDisabled();
  });
});
