import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/map",
}));

vi.mock("next/dynamic", () => ({
  default: (..._args: unknown[]) => {
    const Mock = () => <div data-testid="map-view" />;
    Mock.displayName = "MockMapView";
    return Mock;
  },
}));

vi.mock("@/components/discovery/search-bar", () => ({
  SearchBar: ({ onSubmit }: { onSubmit: (q: string) => void }) => (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit("espresso");
      }}
    >
      <button type="submit">Search</button>
    </form>
  ),
}));

vi.mock("@/components/discovery/filter-pills", () => ({
  FilterPills: () => <div data-testid="filter-pills" />,
}));

vi.mock("@/components/map/map-mini-card", () => ({
  MapMiniCard: ({
    shop,
    onDismiss,
  }: {
    shop: { name: string };
    onDismiss: () => void;
  }) => (
    <div data-testid="mini-card">
      {shop.name}
      <button onClick={onDismiss}>dismiss</button>
    </div>
  ),
}));

import MapPage from "./page";

describe("Map page", () => {
  it("renders map view and search overlay", () => {
    render(<MapPage />);
    expect(screen.getByTestId("map-view")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
  });

  it("renders filter pills in the search overlay", () => {
    render(<MapPage />);
    expect(screen.getByTestId("filter-pills")).toBeInTheDocument();
  });

  it("does not show mini card when no shop pin is selected", () => {
    render(<MapPage />);
    expect(screen.queryByTestId("mini-card")).not.toBeInTheDocument();
  });
});
