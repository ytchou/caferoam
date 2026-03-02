'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface Shop {
  id: string;
  name: string;
  address: string;
  processing_status: string;
  source: string;
  enriched_at: string | null;
}

interface ShopsResponse {
  shops: Shop[];
  total: number;
  offset: number;
  limit: number;
}

const STATUS_OPTIONS = ['all', 'pending', 'enriched', 'live', 'failed'] as const;
const SOURCE_OPTIONS = ['all', 'cafe_nomad', 'manual', 'google_takeout', 'user_submission'] as const;
const PAGE_SIZE = 20;

export default function AdminShopsList() {
  const router = useRouter();
  const [shops, setShops] = useState<Shop[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShops = useCallback(
    async (searchTerm: string, status: string, source: string, currentOffset: number) => {
      setLoading(true);
      setError(null);

      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (status !== 'all') params.set('processing_status', status);
        if (source !== 'all') params.set('source', source);
        params.set('offset', String(currentOffset));
        params.set('limit', String(PAGE_SIZE));

        const queryString = params.toString();
        const url = `/api/admin/shops${queryString ? `?${queryString}` : ''}`;

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (!res.ok) {
          const body = await res.json();
          setError(body.detail || 'Failed to load shops');
          return;
        }

        const data: ShopsResponse = await res.json();
        setShops(data.shops);
        setTotal(data.total);
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
  }, [fetchShops, appliedSearch, statusFilter, sourceFilter, offset]);

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setOffset(0);
      setAppliedSearch(value);
    }, 300);
  }

  function handleSearchKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setOffset(0);
      setAppliedSearch(search);
    }
  }

  function handleStatusChange(value: string) {
    setStatusFilter(value);
    setOffset(0);
  }

  function handleSourceChange(value: string) {
    setSourceFilter(value);
    setOffset(0);
  }

  async function handleCreateShop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      latitude: parseFloat(formData.get('latitude') as string),
      longitude: parseFloat(formData.get('longitude') as string),
    };

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json();
        setCreateError(body.detail || 'Failed to create shop');
        return;
      }

      setShowCreateForm(false);
      fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
    } catch {
      setCreateError('Network error');
    } finally {
      setCreateLoading(false);
    }
  }

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Shops</h1>
        <button
          type="button"
          onClick={() => setShowCreateForm((v) => !v)}
          className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Create Shop
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateShop}
          className="space-y-3 rounded-lg border p-4"
        >
          <div>
            <label htmlFor="shop-name" className="block text-sm font-medium">
              Name
            </label>
            <input
              id="shop-name"
              name="name"
              type="text"
              required
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="shop-address" className="block text-sm font-medium">
              Address
            </label>
            <input
              id="shop-address"
              name="address"
              type="text"
              required
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="shop-latitude"
                className="block text-sm font-medium"
              >
                Latitude
              </label>
              <input
                id="shop-latitude"
                name="latitude"
                type="number"
                step="any"
                required
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="shop-longitude"
                className="block text-sm font-medium"
              >
                Longitude
              </label>
              <input
                id="shop-longitude"
                name="longitude"
                type="number"
                step="any"
                required
                className="mt-1 w-full rounded border px-3 py-2 text-sm"
              />
            </div>
          </div>
          {createError && (
            <p className="text-sm text-red-600">{createError}</p>
          )}
          <button
            type="submit"
            disabled={createLoading}
            className="rounded bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
          >
            {createLoading ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}

      <div className="flex gap-4">
        <input
          type="text"
          placeholder="Search shops..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="flex-1 rounded border px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => handleSourceChange(e.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!error && (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Address</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Enriched</th>
              </tr>
            </thead>
            <tbody>
              {shops.map((shop) => (
                <tr
                  key={shop.id}
                  onClick={() => router.push(`/admin/shops/${shop.id}`)}
                  className="cursor-pointer border-b hover:bg-gray-50"
                >
                  <td className="py-2">{shop.name}</td>
                  <td className="py-2 text-gray-600">{shop.address}</td>
                  <td className="py-2">{shop.processing_status}</td>
                  <td className="py-2 text-gray-500">{shop.source}</td>
                  <td className="py-2 text-gray-500">
                    {shop.enriched_at ? new Date(shop.enriched_at).toLocaleDateString() : '—'}
                  </td>
                </tr>
              ))}
              {!loading && shops.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    No shops found
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {total} shop{total !== 1 ? 's' : ''} total
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
                className="rounded border px-3 py-1 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={() => setOffset((o) => o + PAGE_SIZE)}
                className="rounded border px-3 py-1 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
