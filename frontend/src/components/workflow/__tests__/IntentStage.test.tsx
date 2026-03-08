import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntentStage } from "../IntentStage";
import type { TaskType } from "../../../types";

function renderIntent(
  overrides: Partial<Parameters<typeof IntentStage>[0]> = {},
) {
  const defaults = {
    roughIntent: "",
    taskType: "refactor" as TaskType,
    onIntentChange: vi.fn(),
    onContinue: vi.fn(),
    onSkipToModel: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<IntentStage {...props} />), props };
}

describe("IntentStage", () => {
  it("renders textarea", () => {
    renderIntent();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows task-type-conditional hints for refactor", () => {
    renderIntent({ taskType: "refactor" });
    expect(screen.getByText(/restructuring/i)).toBeInTheDocument();
  });

  it("shows task-type-conditional hints for frontend", () => {
    renderIntent({ taskType: "frontend" });
    expect(screen.getByText(/UI changes/i)).toBeInTheDocument();
  });

  it("shows task-type-conditional hints for audit", () => {
    renderIntent({ taskType: "audit" });
    expect(screen.getByText(/evaluated/i)).toBeInTheDocument();
  });

  it("shows task-type-conditional hints for implement", () => {
    renderIntent({ taskType: "implement" });
    expect(screen.getByText(/specific changes/i)).toBeInTheDocument();
  });

  it("calls onIntentChange when typing", async () => {
    const user = userEvent.setup();
    const { props } = renderIntent();

    await user.type(screen.getByRole("textbox"), "a");
    expect(props.onIntentChange).toHaveBeenCalled();
  });

  it("continue button calls onContinue", async () => {
    const user = userEvent.setup();
    const { props } = renderIntent({ roughIntent: "do something" });

    await user.click(
      screen.getByRole("button", { name: /continue to clarification/i }),
    );
    expect(props.onContinue).toHaveBeenCalledOnce();
  });

  it("skip button calls onSkipToModel", async () => {
    const user = userEvent.setup();
    const { props } = renderIntent({ roughIntent: "do something" });

    await user.click(screen.getByRole("button", { name: /skip to model/i }));
    expect(props.onSkipToModel).toHaveBeenCalledOnce();
  });

  it("buttons are disabled when intent is empty", () => {
    renderIntent({ roughIntent: "" });
    expect(
      screen.getByRole("button", { name: /continue to clarification/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /skip to model/i }),
    ).toBeDisabled();
  });
});
