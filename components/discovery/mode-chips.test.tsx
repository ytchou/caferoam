import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ModeChips } from './mode-chips';

describe('ModeChips', () => {
  it('renders four mode chips', () => {
    render(<ModeChips activeMode={null} onModeChange={vi.fn()} />);
    expect(screen.getByText('工作')).toBeInTheDocument();
    expect(screen.getByText('放鬆')).toBeInTheDocument();
    expect(screen.getByText('社交')).toBeInTheDocument();
    expect(screen.getByText('精品')).toBeInTheDocument();
  });

  it('tapping a chip fires onModeChange with mode key', async () => {
    const onModeChange = vi.fn();
    render(<ModeChips activeMode={null} onModeChange={onModeChange} />);
    await userEvent.click(screen.getByText('工作'));
    expect(onModeChange).toHaveBeenCalledWith('work');
  });

  it('tapping the active chip deselects it (fires onModeChange with null)', async () => {
    const onModeChange = vi.fn();
    render(<ModeChips activeMode="work" onModeChange={onModeChange} />);
    await userEvent.click(screen.getByText('工作'));
    expect(onModeChange).toHaveBeenCalledWith(null);
  });

  it('only one chip is visually active at a time', () => {
    render(<ModeChips activeMode="work" onModeChange={vi.fn()} />);
    const workChip = screen.getByText('工作').closest('button');
    const restChip = screen.getByText('放鬆').closest('button');
    expect(workChip).toHaveAttribute('aria-pressed', 'true');
    expect(restChip).toHaveAttribute('aria-pressed', 'false');
  });
});
