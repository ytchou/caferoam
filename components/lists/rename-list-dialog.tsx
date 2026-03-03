'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface RenameListDialogProps {
  listId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: (listId: string, name: string) => Promise<void>;
}

export function RenameListDialog({
  listId,
  currentName,
  open,
  onOpenChange,
  onRename,
}: RenameListDialogProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await onRename(listId, name.trim());
      onOpenChange(false);
    } catch {
      toast.error('Failed to rename list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Rename list</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
