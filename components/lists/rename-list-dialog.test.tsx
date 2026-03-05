import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RenameListDialog } from './rename-list-dialog';

vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));

import { toast } from 'sonner';

describe('RenameListDialog', () => {
  const defaultProps = {
    listId: 'list-g7h8i9',
    currentName: '適合工作的咖啡店',
    open: true,
    onOpenChange: vi.fn(),
    onRename: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the dialog with the current list name pre-filled', () => {
    render(<RenameListDialog {...defaultProps} />);

    expect(
      screen.getByRole('heading', { name: /rename list/i })
    ).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(input).toHaveValue('適合工作的咖啡店');
  });

  it('does not render when open is false', () => {
    render(<RenameListDialog {...defaultProps} open={false} />);

    expect(
      screen.queryByRole('heading', { name: /rename list/i })
    ).not.toBeInTheDocument();
  });

  it('closes without calling onRename when the admin clicks Cancel', async () => {
    const user = userEvent.setup();
    render(<RenameListDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it('closes without calling onRename when the name is unchanged', async () => {
    const user = userEvent.setup();
    render(<RenameListDialog {...defaultProps} />);

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
    expect(defaultProps.onRename).not.toHaveBeenCalled();
  });

  it('calls onRename with the new name and closes when the admin saves a valid new name', async () => {
    defaultProps.onRename.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<RenameListDialog {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '週末悠閒咖啡廳');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(defaultProps.onRename).toHaveBeenCalledWith(
      'list-g7h8i9',
      '週末悠閒咖啡廳'
    );
    expect(defaultProps.onOpenChange).toHaveBeenCalledWith(false);
  });

  it('shows an error toast when onRename throws and keeps the dialog open', async () => {
    defaultProps.onRename.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(<RenameListDialog {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, '新的清單名稱');

    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(toast.error).toHaveBeenCalledWith('Failed to rename list');
    expect(defaultProps.onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('disables the Save button when the input is empty', async () => {
    const user = userEvent.setup();
    render(<RenameListDialog {...defaultProps} />);

    const input = screen.getByRole('textbox');
    await user.clear(input);

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
  });

  it('resets the input to currentName when reopened', () => {
    const { rerender } = render(
      <RenameListDialog {...defaultProps} open={false} />
    );

    rerender(
      <RenameListDialog
        {...defaultProps}
        open={true}
        currentName="週末精選咖啡"
      />
    );

    expect(screen.getByRole('textbox')).toHaveValue('週末精選咖啡');
  });
});
