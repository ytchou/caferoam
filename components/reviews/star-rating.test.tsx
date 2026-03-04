import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { StarRating } from './star-rating';

describe('StarRating', () => {
  it('shows 5 stars when displaying a rating', () => {
    render(<StarRating value={3} />);
    const stars = screen.getAllByRole('img', { hidden: true });
    expect(stars).toHaveLength(5);
  });

  it('shows the correct number of filled stars for the given rating', () => {
    const { container } = render(<StarRating value={4} />);
    const filled = container.querySelectorAll('[data-filled="true"]');
    expect(filled).toHaveLength(4);
  });

  it('calls onChange when a star is clicked in interactive mode', async () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const stars = screen.getAllByRole('button');
    expect(stars).toHaveLength(5);
    await userEvent.click(stars[2]); // 3rd star
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it('stars are not interactive when no onChange handler is provided', () => {
    render(<StarRating value={3} />);
    const buttons = screen.queryAllByRole('button');
    expect(buttons).toHaveLength(0);
  });

  it('can clear selection by clicking the same star', async () => {
    const onChange = vi.fn();
    render(<StarRating value={3} onChange={onChange} />);
    const stars = screen.getAllByRole('button');
    await userEvent.click(stars[2]); // Click 3rd star again to deselect
    expect(onChange).toHaveBeenCalledWith(0);
  });
});
