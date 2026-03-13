import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MenuHighlights } from './menu-highlights';

describe('MenuHighlights', () => {
  const items = [
    { name: '手沖咖啡', emoji: '☕', price: 'NT$180' },
    { name: '巴斯克蛋糕', emoji: '🍰', price: 'NT$150' },
    { name: '肉桂捲', emoji: '🧁', price: 'NT$120' },
  ];

  it('a visitor sees up to 3 menu items with emoji and price', () => {
    render(<MenuHighlights items={items} />);
    expect(screen.getByText(/手沖咖啡/)).toBeInTheDocument();
    expect(screen.getByText(/NT\$180/)).toBeInTheDocument();
    expect(screen.getByText(/巴斯克蛋糕/)).toBeInTheDocument();
    expect(screen.getByText(/肉桂捲/)).toBeInTheDocument();
  });

  it('does not render when items array is empty', () => {
    const { container } = render(<MenuHighlights items={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('caps display at 3 items even if more are provided', () => {
    const manyItems = [
      ...items,
      { name: '拿鐵', emoji: '☕', price: 'NT$160' },
    ];
    render(<MenuHighlights items={manyItems} />);
    expect(screen.queryByText(/拿鐵/)).not.toBeInTheDocument();
  });
});
