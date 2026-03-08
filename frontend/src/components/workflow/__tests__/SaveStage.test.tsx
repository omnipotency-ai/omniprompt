import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SaveStage } from "../SaveStage";

function renderSave(overrides: Partial<Parameters<typeof SaveStage>[0]> = {}) {
  const defaults = {
    title: "My prompt",
    targetModel: "gpt-5.4" as const,
    expectedResultAssessment: "",
    effectivenessRating: 0,
    onTitleChange: vi.fn(),
    onAssessmentChange: vi.fn(),
    onRatingChange: vi.fn(),
    onSave: vi.fn(),
  };
  const props = { ...defaults, ...overrides };
  return { ...render(<SaveStage {...props} />), props };
}

describe("SaveStage", () => {
  it("renders title input, rating buttons (1-7), and assessment textarea", () => {
    const { container } = renderSave();
    // Title input
    expect(screen.getByDisplayValue("My prompt")).toBeInTheDocument();
    // Rating buttons 1-7 (inside the rating label wrapper)
    const ratingButtons = container.querySelectorAll(".flex.gap-1\\.5 button");
    expect(ratingButtons.length).toBe(7);
    for (let i = 0; i < 7; i++) {
      expect(ratingButtons[i].textContent).toBe(String(i + 1));
    }
    // Assessment textarea
    expect(
      screen.getByPlaceholderText(/what result do you expect/i),
    ).toBeInTheDocument();
  });

  it("clicking a rating button calls onRatingChange", async () => {
    const user = userEvent.setup();
    const { props } = renderSave();

    await user.click(screen.getByRole("button", { name: "5" }));
    expect(props.onRatingChange).toHaveBeenCalledWith(5);
  });

  it("save button calls onSave", async () => {
    const user = userEvent.setup();
    const { props } = renderSave();

    await user.click(screen.getByRole("button", { name: /save to library/i }));
    expect(props.onSave).toHaveBeenCalledOnce();
  });

  it("save button is disabled when disabled prop is true", () => {
    renderSave({ disabled: true });
    expect(
      screen.getByRole("button", { name: /save to library/i }),
    ).toBeDisabled();
  });

  it("save button is disabled when loading", () => {
    renderSave({ loading: true });
    expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
  });

  it("shows success message when provided", () => {
    renderSave({ successMessage: "Saved successfully!" });
    expect(screen.getByText("Saved successfully!")).toBeInTheDocument();
  });

  it("shows target model label", () => {
    renderSave({ targetModel: "gpt-5.4" });
    expect(screen.getByText("GPT-5.4")).toBeInTheDocument();
  });
});
