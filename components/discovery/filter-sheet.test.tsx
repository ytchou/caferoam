import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/posthog/use-analytics", () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

import { FilterSheet } from "./filter-sheet";

// Mock vaul Drawer since it requires a real DOM portal
vi.mock("vaul", () => ({
  Drawer: {
    Root: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
      open ? <div data-testid="drawer">{children}</div> : null,
    Portal: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    Overlay: () => <div data-testid="overlay" />,
    Content: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="drawer-content">{children}</div>
    ),
    Handle: () => <div data-testid="drawer-handle" />,
    Title: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  },
}));

describe("FilterSheet", () => {
  it("renders taxonomy dimension sections with checkboxes", () => {
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={vi.fn()}
        initialFilters={[]}
      />
    );
    // Should show at least one dimension section
    expect(screen.getByTestId("drawer")).toBeInTheDocument();
    // Should show checkboxes
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it("clicking apply fires onApply with selected tag IDs", async () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialFilters={[]}
      />
    );
    const checkboxes = screen.getAllByRole("checkbox");
    await userEvent.click(checkboxes[0]);
    await userEvent.click(screen.getByText("套用"));
    expect(onApply).toHaveBeenCalledWith(expect.any(Array));
  });

  it("clicking clear resets all selections", async () => {
    const onApply = vi.fn();
    render(
      <FilterSheet
        open={true}
        onClose={vi.fn()}
        onApply={onApply}
        initialFilters={["wifi"]}
      />
    );
    await userEvent.click(screen.getByText("清除"));
    await userEvent.click(screen.getByText("套用"));
    expect(onApply).toHaveBeenCalledWith([]);
  });
});
