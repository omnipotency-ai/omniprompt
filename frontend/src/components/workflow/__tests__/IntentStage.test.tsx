import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
    reformulateIntent: vi.fn().mockResolvedValue("Reformulated text"),
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

  it("reformulate button calls reformulateIntent then shows review step", async () => {
    const user = userEvent.setup();
    const reformulateIntent = vi
      .fn()
      .mockResolvedValue("Clear reformulated text");
    renderIntent({ roughIntent: "do something", reformulateIntent });

    await user.click(
      screen.getByRole("button", { name: /reformulate and continue/i }),
    );

    await waitFor(() => {
      expect(reformulateIntent).toHaveBeenCalledWith("do something");
    });

    // Review step should be visible — the editable reformulated textarea
    expect(screen.getByLabelText(/reformulated intent/i)).toBeInTheDocument();
    // The accept button should appear
    expect(
      screen.getByRole("button", {
        name: /use this and continue to clarification/i,
      }),
    ).toBeInTheDocument();
  });

  it("skip reformulation button calls onContinue directly", async () => {
    const user = userEvent.setup();
    const { props } = renderIntent({ roughIntent: "do something" });

    await user.click(
      screen.getByRole("button", { name: /skip reformulation/i }),
    );
    expect(props.onContinue).toHaveBeenCalledOnce();
  });

  it("skip to model button calls onSkipToModel", async () => {
    const user = userEvent.setup();
    const { props } = renderIntent({ roughIntent: "do something" });

    await user.click(screen.getByRole("button", { name: /skip to model/i }));
    expect(props.onSkipToModel).toHaveBeenCalledOnce();
  });

  it("buttons are disabled when intent is empty", () => {
    renderIntent({ roughIntent: "" });
    expect(
      screen.getByRole("button", { name: /reformulate and continue/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /skip reformulation/i }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /skip to model/i }),
    ).toBeDisabled();
  });

  it("shows error inline when reformulation fails, stays on write step", async () => {
    const user = userEvent.setup();
    const reformulateIntent = vi
      .fn()
      .mockRejectedValue(new Error("Model failed"));
    renderIntent({ roughIntent: "do something", reformulateIntent });

    await user.click(
      screen.getByRole("button", { name: /reformulate and continue/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/model failed/i)).toBeInTheDocument();
    });

    // Should still be on write step — textarea still visible
    expect(
      screen.getByRole("textbox", { name: /what do you need done/i }),
    ).toBeInTheDocument();
  });

  it("review step accept calls onContinue with reformulated text", async () => {
    const user = userEvent.setup();
    const reformulateIntent = vi
      .fn()
      .mockResolvedValue("Clean reformulated text");
    const onContinue = vi.fn();
    const onIntentChange = vi.fn();
    renderIntent({
      roughIntent: "messy text",
      reformulateIntent,
      onContinue,
      onIntentChange,
    });

    await user.click(
      screen.getByRole("button", { name: /reformulate and continue/i }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/reformulated intent/i)).toBeInTheDocument();
    });

    await user.click(
      screen.getByRole("button", {
        name: /use this and continue to clarification/i,
      }),
    );

    expect(onIntentChange).toHaveBeenCalledWith("Clean reformulated text");
    expect(onContinue).toHaveBeenCalledOnce();
  });

  it("review step edit original returns to write step", async () => {
    const user = userEvent.setup();
    const reformulateIntent = vi.fn().mockResolvedValue("Reformulated text");
    renderIntent({ roughIntent: "some intent", reformulateIntent });

    await user.click(
      screen.getByRole("button", { name: /reformulate and continue/i }),
    );
    await waitFor(() => {
      expect(screen.getByLabelText(/reformulated intent/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /edit original/i }));

    // Should be back on write step — original textarea visible
    expect(
      screen.getByRole("textbox", { name: /what do you need done/i }),
    ).toBeInTheDocument();
  });
});
