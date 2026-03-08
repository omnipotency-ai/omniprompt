import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkflowStage } from "../WorkflowStage";

function renderStage(
  overrides: Partial<Parameters<typeof WorkflowStage>[0]> = {},
) {
  const defaults = {
    stageNumber: 2,
    title: "Intent",
    status: "active" as const,
    children: <p>stage content</p>,
  };
  return render(<WorkflowStage {...defaults} {...overrides} />);
}

describe("WorkflowStage", () => {
  it("renders title and stage number", () => {
    renderStage({ status: "active" });
    expect(screen.getByText("Intent")).toBeInTheDocument();
    // Stage number is shown when active
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("shows content when status is active", () => {
    renderStage({ status: "active", children: <p>active content</p> });
    expect(screen.getByText("active content")).toBeInTheDocument();
  });

  it("shows summary when status is complete (collapsed)", () => {
    renderStage({
      status: "complete",
      summary: "Refactor selected",
      children: <p>hidden content</p>,
    });
    expect(screen.getByText("Refactor selected")).toBeInTheDocument();
    expect(screen.queryByText("hidden content")).not.toBeInTheDocument();
  });

  it("hides content when status is idle", () => {
    renderStage({ status: "idle", children: <p>hidden content</p> });
    expect(screen.queryByText("hidden content")).not.toBeInTheDocument();
  });

  it("shows lock icon when idle", () => {
    const { container } = renderStage({ status: "idle" });
    // Lock icon renders as an SVG with class "lucide-lock"
    expect(container.querySelector(".lucide-lock")).toBeInTheDocument();
    // Stage number should NOT be shown
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("shows check icon when complete", () => {
    const { container } = renderStage({ status: "complete" });
    // Check icon renders as an SVG with class "lucide-check"
    expect(container.querySelector(".lucide-check")).toBeInTheDocument();
    // Stage number should NOT be shown
    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("calls onToggle when clicking a completed stage header", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderStage({ status: "complete", onToggle });

    await user.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it("does NOT call onToggle when clicking an idle stage header", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    renderStage({ status: "idle", onToggle });

    // Button is disabled when idle, click should not fire
    await user.click(screen.getByRole("button"));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("has correct ARIA attributes when active", () => {
    renderStage({ stageNumber: 3, status: "active" });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(button).toHaveAttribute("aria-controls", "workflow-stage-3-content");
  });

  it("has correct ARIA attributes when not active", () => {
    renderStage({ stageNumber: 3, status: "complete" });
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button).toHaveAttribute("aria-controls", "workflow-stage-3-content");
  });
});
