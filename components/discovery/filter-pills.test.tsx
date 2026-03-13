import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/posthog/use-analytics", () => ({
  useAnalytics: () => ({ capture: vi.fn() }),
}));

import { FilterPills } from "./filter-pills";

describe("FilterPills", () => {
  it("renders filter pills including 篩選 button", () => {
    render(
      <FilterPills activeFilters={[]} onToggle={vi.fn()} onOpenSheet={vi.fn()} />
    );
    expect(screen.getByText("距離")).toBeInTheDocument();
    expect(screen.getByText("現正營業")).toBeInTheDocument();
    expect(screen.getByText("有插座")).toBeInTheDocument();
    expect(screen.getByText("評分")).toBeInTheDocument();
    expect(screen.getByText("篩選")).toBeInTheDocument();
  });

  it("tapping a pill fires onToggle with filter key", async () => {
    const onToggle = vi.fn();
    render(
      <FilterPills activeFilters={[]} onToggle={onToggle} onOpenSheet={vi.fn()} />
    );
    await userEvent.click(screen.getByText("有插座"));
    expect(onToggle).toHaveBeenCalledWith("outlet");
  });

  it("tapping 篩選 fires onOpenSheet", async () => {
    const onOpenSheet = vi.fn();
    render(
      <FilterPills activeFilters={[]} onToggle={vi.fn()} onOpenSheet={onOpenSheet} />
    );
    await userEvent.click(screen.getByText("篩選"));
    expect(onOpenSheet).toHaveBeenCalled();
  });

  it("active filters show filled style (aria-pressed=true)", () => {
    render(
      <FilterPills
        activeFilters={["outlet"]}
        onToggle={vi.fn()}
        onOpenSheet={vi.fn()}
      />
    );
    const outletBtn = screen.getByText("有插座").closest("button");
    expect(outletBtn).toHaveAttribute("aria-pressed", "true");
  });
});
