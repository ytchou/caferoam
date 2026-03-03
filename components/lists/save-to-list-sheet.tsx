'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';

interface SaveToListSheetProps {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveToListSheet({ shopId, open, onOpenChange }: SaveToListSheetProps) {
  const { lists, isInList, saveShop, removeShop, createList } = useUserLists();
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleToggle(listId: string) {
    try {
      if (isInList(listId, shopId)) {
        await removeShop(listId, shopId);
      } else {
        await saveShop(listId, shopId);
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      await createList(newListName.trim());
      setNewListName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create list';
      if (message.includes('3') || message.includes('Maximum')) {
        toast.error("You've reached the 3-list limit");
      } else {
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Save to list</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          {lists.map((list) => (
            <label
              key={list.id}
              className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                aria-label={list.name}
                checked={isInList(list.id, shopId)}
                onChange={() => handleToggle(list.id)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <span className="flex-1 text-sm font-medium">{list.name}</span>
              <span className="text-xs text-gray-400">{list.items.length}</span>
            </label>
          ))}
          {lists.length < 3 && (
            <div className="mt-2 flex items-center gap-2">
              <Plus className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Create new list"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1 border-b border-gray-200 bg-transparent py-1 text-sm outline-none focus:border-gray-400"
                disabled={creating}
              />
              {newListName.trim() && (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-sm font-medium text-blue-600"
                >
                  Add
                </button>
              )}
            </div>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose>
            <button className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white">
              Done
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
