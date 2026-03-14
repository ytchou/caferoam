import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SuggestionChips } from './suggestion-chips';

describe('SuggestionChips', () => {
  it('when a user taps a text chip, onSelect fires with the chip text', () => {
    const onSelect = vi.fn();
    const onNearMe = vi.fn();
    render(<SuggestionChips onSelect={onSelect} onNearMe={onNearMe} />);
    fireEvent.click(screen.getByText('巴斯克蛋糕'));
    expect(onSelect).toHaveBeenCalledWith('巴斯克蛋糕');
    expect(onNearMe).not.toHaveBeenCalled();
  });

  it('when a user taps "我附近", onNearMe fires instead of onSelect', () => {
    const onSelect = vi.fn();
    const onNearMe = vi.fn();
    render(<SuggestionChips onSelect={onSelect} onNearMe={onNearMe} />);
    fireEvent.click(screen.getByText('我附近'));
    expect(onNearMe).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
