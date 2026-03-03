import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

const mockSaveShop = vi.fn();
const mockRemoveShop = vi.fn();
const mockCreateList = vi.fn();

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: [
      { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }] },
      { id: 'l2', name: 'Date night', items: [{ shop_id: 's3' }] },
    ],
    isSaved: vi.fn(),
    isInList: (listId: string, shopId: string) => {
      if (listId === 'l1' && (shopId === 's1' || shopId === 's2')) return true;
      if (listId === 'l2' && shopId === 's3') return true;
      return false;
    },
    saveShop: mockSaveShop,
    removeShop: mockRemoveShop,
    createList: mockCreateList,
    deleteList: vi.fn(),
    renameList: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock vaul/drawer — render children directly
vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? <div>{children}</div> : null,
  DrawerContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DrawerFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DrawerClose: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { SaveToListSheet } from './save-to-list-sheet';

describe('SaveToListSheet', () => {
  it('shows checked state for lists containing the shop', () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    const workCheckbox = screen.getByRole('checkbox', { name: /work spots/i });
    const dateCheckbox = screen.getByRole('checkbox', { name: /date night/i });
    expect(workCheckbox).toBeChecked();
    expect(dateCheckbox).not.toBeChecked();
  });

  it('calls saveShop when unchecked list is toggled', async () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    const dateCheckbox = screen.getByRole('checkbox', { name: /date night/i });
    await userEvent.click(dateCheckbox);
    expect(mockSaveShop).toHaveBeenCalledWith('l2', 's1');
  });

  it('calls removeShop when checked list is toggled', async () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    const workCheckbox = screen.getByRole('checkbox', { name: /work spots/i });
    await userEvent.click(workCheckbox);
    expect(mockRemoveShop).toHaveBeenCalledWith('l1', 's1');
  });

  it('shows create new list form when fewer than 3 lists', () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByPlaceholderText(/create new list/i)).toBeInTheDocument();
  });
});
