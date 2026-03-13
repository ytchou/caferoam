import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

vi.mock("@/components/discovery/search-bar", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  SearchBar: ({ onSubmit: _onSubmit }: { onSubmit: (q: string) => void }) => (
    <div data-testid="search-bar" />
  ),
}));

import { HeaderNav } from "./header-nav";

describe("HeaderNav", () => {
  it("renders logo", () => {
    render(<HeaderNav onSearch={vi.fn()} />);
    expect(screen.getByText(/啡遊|CafeRoam/i)).toBeInTheDocument();
  });

  it("renders navigation links", () => {
    render(<HeaderNav onSearch={vi.fn()} />);
    expect(screen.getByRole("link", { name: /地圖/i })).toHaveAttribute("href", "/map");
    expect(screen.getByRole("link", { name: /收藏/i })).toHaveAttribute("href", "/lists");
  });

  it("renders search bar", () => {
    render(<HeaderNav onSearch={vi.fn()} />);
    expect(screen.getByTestId("search-bar")).toBeInTheDocument();
  });
});
