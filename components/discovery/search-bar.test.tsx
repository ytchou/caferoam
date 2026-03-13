import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/posthog/use-analytics", () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

import { SearchBar } from "./search-bar";

describe("SearchBar", () => {
  it("renders input with placeholder text", () => {
    render(<SearchBar onSubmit={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("找間有巴斯克蛋糕的咖啡廳…")
    ).toBeInTheDocument();
  });

  it("renders sparkle icon", () => {
    render(<SearchBar onSubmit={vi.fn()} />);
    expect(screen.getByRole("img", { name: /search/i })).toBeInTheDocument();
  });

  it("submitting form fires onSubmit with query text", async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    const input = screen.getByPlaceholderText("找間有巴斯克蛋糕的咖啡廳…");
    await userEvent.type(input, "espresso");
    fireEvent.submit(input.closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("espresso");
  });

  it("empty submission is prevented", async () => {
    const onSubmit = vi.fn();
    render(<SearchBar onSubmit={onSubmit} />);
    const form = screen.getByRole("search");
    fireEvent.submit(form);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("defaultQuery pre-fills the input", () => {
    render(<SearchBar onSubmit={vi.fn()} defaultQuery="latte" />);
    expect(screen.getByDisplayValue("latte")).toBeInTheDocument();
  });
});
