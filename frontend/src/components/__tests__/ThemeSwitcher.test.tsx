import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeSwitcher } from "../ThemeSwitcher";

beforeEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
});

describe("ThemeSwitcher", () => {
  it("renders a button", () => {
    localStorage.setItem("prompt-os-theme", "light");
    render(<ThemeSwitcher />);
    expect(screen.getByLabelText(/switch to dark mode/i)).toBeInTheDocument();
  });

  it("toggles data-theme attribute on documentElement", async () => {
    const user = userEvent.setup();
    localStorage.setItem("prompt-os-theme", "light");
    render(<ThemeSwitcher />);

    // After render, useEffect should set data-theme to light
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");

    // Click to toggle to dark
    await user.click(screen.getByLabelText(/switch to dark mode/i));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    // Click again to toggle back to light
    await user.click(screen.getByLabelText(/switch to light mode/i));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("persists to localStorage", async () => {
    const user = userEvent.setup();
    localStorage.setItem("prompt-os-theme", "light");
    render(<ThemeSwitcher />);

    expect(localStorage.getItem("prompt-os-theme")).toBe("light");

    await user.click(screen.getByLabelText(/switch to dark mode/i));
    expect(localStorage.getItem("prompt-os-theme")).toBe("dark");
  });
});
