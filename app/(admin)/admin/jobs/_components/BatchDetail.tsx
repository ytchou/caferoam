'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ShopDetail {
  shop_id: string;
  name: string;
  processing_status: string;
  last_error: string | null;
  failed_at_stage: string | null;
}

interface BatchDetailResponse {
  batch_id: string;
  shops: ShopDetail[];
  total: number;
  status_summary: Record<string, number>;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  scraping: 'bg-blue-100 text-blue-700',
  enriching: 'bg-purple-100 text-purple-700',
  embedding: 'bg-indigo-100 text-indigo-700',
  publishing: 'bg-cyan-100 text-cyan-700',
  live: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
};

const ALL_STATUSES = [
  'pending',
  'scraping',
  'enriching',
  'embedding',
  'publishing',
  'live',
  'failed',
];

const PAGE_SIZE = 20;

export function BatchDetail({
  batchId,
  token,
}: {
  batchId: string;
  token: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<BatchDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search input
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();

    async function doFetch() {
      setLoading(true);
      const params = new URLSearchParams({
        offset: String((page - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (statusFilter) params.set('status', statusFilter);
      try {
        const res = await fetch(`/api/admin/pipeline/batches/${batchId}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.detail || 'Failed to load batch detail');
        } else {
          setData(await res.json());
          setError(null);
        }
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('Failed to load batch detail');
        }
      } finally {
        setLoading(false);
      }
    }

    doFetch();
    return () => controller.abort();
  }, [batchId, token, debouncedSearch, statusFilter, page]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="space-y-3">
      {/* Status summary bar */}
      {data?.status_summary && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(data.status_summary).map(([st, count]) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(statusFilter === st ? '' : st);
                setPage(1);
              }}
              className={`rounded px-2 py-0.5 text-xs ring-1 ring-transparent transition ${
                STATUS_COLORS[st] || 'bg-gray-100 text-gray-700'
              } ${statusFilter === st ? 'ring-current' : 'opacity-80 hover:opacity-100'}`}
            >
              {st}: {count}
            </button>
          ))}
        </div>
      )}

      {/* Search + filter controls */}
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded border px-2 py-1 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="rounded border px-2 py-1 text-sm"
        >
          <option value="">All statuses</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : !data || data.shops.length === 0 ? (
        <p className="text-sm text-gray-500">
          No shops match the current filter.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-gray-500">
              <th className="pb-1">Shop</th>
              <th className="pb-1">Status</th>
              <th className="pb-1">Error</th>
            </tr>
          </thead>
          <tbody>
            {data.shops.map((shop) => (
              <tr
                key={shop.shop_id}
                className="cursor-pointer border-t hover:bg-gray-100"
                onClick={() => router.push(`/admin/shops/${shop.shop_id}`)}
              >
                <td className="py-1">{shop.name || shop.shop_id}</td>
                <td className="py-1">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      STATUS_COLORS[shop.processing_status] ||
                      'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {shop.processing_status}
                  </span>
                </td>
                <td className="max-w-xs truncate py-1 text-xs text-red-600">
                  {shop.last_error
                    ? `[${shop.failed_at_stage}] ${shop.last_error.slice(0, 80)}${shop.last_error.length > 80 ? '…' : ''}`
                    : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
