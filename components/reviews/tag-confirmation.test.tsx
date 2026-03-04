import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TagConfirmation } from './tag-confirmation';
import type { TaxonomyTag } from '@/lib/types';

const mockTags: TaxonomyTag[] = [
  {
    id: 'good_wifi',
    dimension: 'functionality',
    label: 'Good WiFi',
    labelZh: '穩定WiFi',
  },
  { id: 'quiet', dimension: 'ambience', label: 'Quiet', labelZh: '安靜' },
  {
    id: 'laptop_friendly',
    dimension: 'functionality',
    label: 'Laptop Friendly',
    labelZh: '適合帶筆電',
  },
];

describe('TagConfirmation', () => {
  it('renders all shop tags as chips', () => {
    render(
      <TagConfirmation tags={mockTags} confirmedIds={[]} onChange={vi.fn()} />
    );
    expect(screen.getByText('穩定WiFi')).toBeInTheDocument();
    expect(screen.getByText('安靜')).toBeInTheDocument();
    expect(screen.getByText('適合帶筆電')).toBeInTheDocument();
  });

  it('highlights confirmed tags', () => {
    const { container } = render(
      <TagConfirmation
        tags={mockTags}
        confirmedIds={['good_wifi']}
        onChange={vi.fn()}
      />
    );
    const confirmed = container.querySelectorAll('[data-confirmed="true"]');
    expect(confirmed).toHaveLength(1);
  });

  it('toggles tag on click and calls onChange', async () => {
    const onChange = vi.fn();
    render(
      <TagConfirmation tags={mockTags} confirmedIds={[]} onChange={onChange} />
    );
    await userEvent.click(screen.getByText('安靜'));
    expect(onChange).toHaveBeenCalledWith(['quiet']);
  });

  it('removes tag on click when already confirmed', async () => {
    const onChange = vi.fn();
    render(
      <TagConfirmation
        tags={mockTags}
        confirmedIds={['quiet']}
        onChange={onChange}
      />
    );
    await userEvent.click(screen.getByText('安靜'));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
