import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

// Mock next/navigation
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
}));

// Mock child components that have their own tests
vi.mock("@/components/discovery/search-bar", () => ({
  SearchBar: ({ onSubmit }: { onSubmit: (q: string) => void }) => (
    <div>
      <input placeholder="search" onChange={() => {}} />
      <button onClick={() => onSubmit("espresso")}>Search</button>
    </div>
  ),
}));
vi.mock("@/components/discovery/suggestion-chips", () => ({
  SuggestionChips: ({ onSelect }: { onSelect: (s: string) => void }) => (
    <button onClick={() => onSelect("適合工作")}>suggestion</button>
  ),
}));
vi.mock("@/components/discovery/mode-chips", () => ({
  ModeChips: () => <div data-testid="mode-chips" />,
}));
vi.mock("@/components/discovery/filter-pills", () => ({
  FilterPills: () => <div data-testid="filter-pills" />,
}));
vi.mock("@/components/shops/shop-card", () => ({
  ShopCard: ({ shop }: { shop: { name: string } }) => <div>{shop.name}</div>,
}));
vi.mock("@/components/discovery/filter-sheet", () => ({
  FilterSheet: () => <div data-testid="filter-sheet" />,
}));

import HomePage from "./page";

const MOCK_SHOPS = [
  { id: "1", name: "山小孩咖啡", slug: "shan-xiao-hai-ka-fei", rating: 4.6 },
  { id: "2", name: "好咖啡", slug: "hao-ka-fei", rating: 4.2 },
];

describe("Home page", () => {
  it("renders search bar", () => {
    render(<HomePage shops={MOCK_SHOPS} />);
    expect(screen.getByPlaceholderText("search")).toBeInTheDocument();
  });

  it("renders featured shop cards", () => {
    render(<HomePage shops={MOCK_SHOPS} />);
    expect(screen.getByText("山小孩咖啡")).toBeInTheDocument();
    expect(screen.getByText("好咖啡")).toBeInTheDocument();
  });

  it("search submission navigates to /map with query param", () => {
    render(<HomePage shops={MOCK_SHOPS} />);
    fireEvent.click(screen.getByText("Search"));
    expect(mockPush).toHaveBeenCalledWith("/map?q=espresso");
  });

  it("suggestion chip selection navigates to /map with query param", () => {
    render(<HomePage shops={MOCK_SHOPS} />);
    fireEvent.click(screen.getByText("suggestion"));
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/map?"));
  });

  it("renders featured section heading", () => {
    render(<HomePage shops={MOCK_SHOPS} />);
    expect(screen.getByText("精選咖啡廳")).toBeInTheDocument();
  });

  it("renders with empty shops list without crashing", () => {
    render(<HomePage shops={[]} />);
    expect(screen.getByPlaceholderText("search")).toBeInTheDocument();
    expect(screen.getByText("精選咖啡廳")).toBeInTheDocument();
  });
});
