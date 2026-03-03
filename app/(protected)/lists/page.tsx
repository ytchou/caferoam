'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { ListCard } from '@/components/lists/list-card';
import { RenameListDialog } from '@/components/lists/rename-list-dialog';

export default function ListsPage() {
  const { lists, isLoading, createList, deleteList, renameList } =
    useUserLists();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(
    null
  );
  const [newListName, setNewListName] = useState('');

  async function handleDelete(listId: string, listName: string) {
    if (!confirm(`Delete "${listName}"? This won't remove the shops.`)) return;
    try {
      await deleteList(listId);
      toast.success('List deleted');
    } catch {
      toast.error('Failed to delete list');
    }
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    try {
      await createList(newListName.trim());
      setNewListName('');
      toast.success('List created');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to create list';
      toast.error(
        message.includes('Maximum')
          ? "You've reached the 3-list limit"
          : message
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading lists...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Lists</h1>
        <span className="text-sm text-gray-500">{lists.length} / 3</span>
      </div>

      {lists.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No lists yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Save shops from the directory to start building your collections.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              id={list.id}
              name={list.name}
              itemCount={list.items.length}
              onRename={() => setRenaming({ id: list.id, name: list.name })}
              onDelete={() => handleDelete(list.id, list.name)}
            />
          ))}
        </div>
      )}

      {lists.length < 3 && (
        <div className="mt-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Create new list"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 border-b border-gray-200 bg-transparent py-2 text-sm outline-none focus:border-gray-400"
          />
          {newListName.trim() && (
            <button
              onClick={handleCreate}
              className="text-sm font-medium text-blue-600"
            >
              Add
            </button>
          )}
        </div>
      )}

      {/* TODO: add mini map here once Mapbox pin integration is ready */}

      {renaming && (
        <RenameListDialog
          listId={renaming.id}
          currentName={renaming.name}
          open={!!renaming}
          onOpenChange={(open) => !open && setRenaming(null)}
          onRename={renameList}
        />
      )}
    </div>
  );
}
