'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import useSWR from 'swr';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { fetchWithAuth } from '@/lib/api/fetch';
import { RenameListDialog } from '@/components/lists/rename-list-dialog';

interface ShopData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  review_count: number;
  photo_urls: string[];
  taxonomy_tags: { label_zh: string }[];
}

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const { lists, removeShop, deleteList, renameList } = useUserLists();
  const list = lists.find((l) => l.id === listId);

  const {
    data: shops = [],
    isLoading: loading,
    mutate: mutateShops,
  } = useSWR<ShopData[]>(`/api/lists/${listId}/shops`, fetchWithAuth);
  const [hoveredShopId, setHoveredShopId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);

  async function handleRemoveShop(shopId: string) {
    try {
      await removeShop(listId, shopId);
      mutateShops(
        shops.filter((s) => s.id !== shopId),
        false
      );
      toast.success('Shop removed');
    } catch {
      toast.error('Failed to remove shop');
    }
  }

  async function handleDeleteList() {
    if (!list) return;
    if (!confirm(`Delete "${list.name}"? This won't remove the shops.`)) return;
    try {
      await deleteList(listId);
      toast.success('List deleted');
      router.push('/lists');
    } catch {
      toast.error('Failed to delete list');
    }
  }

  if (!list && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">List not found</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold">{list?.name}</h1>
        <button
          onClick={() => setRenaming(true)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="Rename list"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={handleDeleteList}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
          aria-label="Delete list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Map placeholder — Mapbox integration deferred */}
      <div className="h-[40vh] w-full bg-gray-100" data-testid="map-area">
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          Map view — {shops.length} pins
        </div>
      </div>

      {/* Shop list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-gray-500">Loading shops...</p>
        ) : shops.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">No shops saved yet</p>
            <p className="mt-1 text-sm text-gray-400">
              Go explore and save some shops!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => (
              <div
                key={shop.id}
                onMouseEnter={() => setHoveredShopId(shop.id)}
                onMouseLeave={() => setHoveredShopId(null)}
                className={`flex items-center justify-between rounded-xl border p-4 transition ${
                  hoveredShopId === shop.id
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 bg-white hover:shadow-sm'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <Link href={`/shops/${shop.id}`}>
                    <h3 className="font-medium text-gray-900 hover:underline">
                      {shop.name}
                    </h3>
                  </Link>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {shop.rating && `★ ${shop.rating}`}
                    {shop.address && ` · ${shop.address}`}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveShop(shop.id)}
                  className="ml-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  aria-label={`Remove ${shop.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {renaming && list && (
        <RenameListDialog
          listId={list.id}
          currentName={list.name}
          open={renaming}
          onOpenChange={setRenaming}
          onRename={renameList}
        />
      )}
    </div>
  );
}
