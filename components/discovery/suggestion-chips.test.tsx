import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { SuggestionChips } from './suggestion-chips';

describe('SuggestionChips', () => {
  it('renders four suggestion chips', () => {
    render(<SuggestionChips onSelect={vi.fn()} />);
    expect(screen.getByText('巴斯克蛋糕')).toBeInTheDocument();
    expect(screen.getByText('適合工作')).toBeInTheDocument();
    expect(screen.getByText('安靜一點')).toBeInTheDocument();
    expect(screen.getByText('我附近')).toBeInTheDocument();
  });

  it('tapping a chip fires onSelect with the chip text', async () => {
    const onSelect = vi.fn();
    render(<SuggestionChips onSelect={onSelect} />);
    await userEvent.click(screen.getByText('適合工作'));
    expect(onSelect).toHaveBeenCalledWith('適合工作');
  });

  it('tapping 我附近 also fires onSelect', async () => {
    const onSelect = vi.fn();
    render(<SuggestionChips onSelect={onSelect} />);
    await userEvent.click(screen.getByText('我附近'));
    expect(onSelect).toHaveBeenCalledWith('我附近');
  });
});
