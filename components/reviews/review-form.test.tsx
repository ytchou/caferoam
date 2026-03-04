import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ReviewForm } from './review-form';
import type { TaxonomyTag } from '@/lib/types';

const mockTags: TaxonomyTag[] = [
  {
    id: 'good_wifi',
    dimension: 'functionality',
    label: 'Good WiFi',
    labelZh: '穩定WiFi',
  },
  { id: 'quiet', dimension: 'ambience', label: 'Quiet', labelZh: '安靜' },
];

describe('ReviewForm', () => {
  it('shows star rating but hides tag confirmation and text until stars selected', () => {
    render(<ReviewForm shopTags={mockTags} onSubmit={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: /star/i })).toHaveLength(5);
    expect(screen.queryByText(/confirm what you/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/how was/i)).not.toBeInTheDocument();
  });

  it('reveals tag confirmation and text when stars are selected', async () => {
    render(<ReviewForm shopTags={mockTags} onSubmit={vi.fn()} />);
    const stars = screen.getAllByRole('button', { name: /star/i });
    await userEvent.click(stars[3]); // 4 stars
    expect(screen.getByText(/confirm what you/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/how was/i)).toBeInTheDocument();
  });

  it('calls onSubmit with review data', async () => {
    const onSubmit = vi.fn();
    render(<ReviewForm shopTags={mockTags} onSubmit={onSubmit} />);

    const stars = screen.getAllByRole('button', { name: /star/i });
    await userEvent.click(stars[3]); // 4 stars

    const textarea = screen.getByPlaceholderText(/how was/i);
    await userEvent.type(textarea, 'Great latte!');

    await userEvent.click(screen.getByText('安靜'));

    const submit = screen.getByRole('button', { name: /save review/i });
    await userEvent.click(submit);

    expect(onSubmit).toHaveBeenCalledWith({
      stars: 4,
      review_text: 'Great latte!',
      confirmed_tags: ['quiet'],
    });
  });

  it('hides review fields when stars are deselected', async () => {
    render(<ReviewForm shopTags={mockTags} onSubmit={vi.fn()} />);
    const stars = screen.getAllByRole('button', { name: /star/i });
    await userEvent.click(stars[3]); // select 4 stars
    expect(screen.getByPlaceholderText(/how was/i)).toBeInTheDocument();
    await userEvent.click(stars[3]); // deselect
    expect(screen.queryByPlaceholderText(/how was/i)).not.toBeInTheDocument();
  });
});
