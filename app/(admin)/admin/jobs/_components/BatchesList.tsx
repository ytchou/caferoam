'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BatchDetail } from './BatchDetail';

interface BatchStatusCounts {
  [status: string]: number;
}

interface Batch {
  batch_id: string;
  created_at: string;
  shop_count: number;
  status_counts: BatchStatusCounts;
}

interface BatchesResponse {
  batches: Batch[];
  total: number;
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

const PAGE_SIZE = 20;

export function BatchesList() {
  const [data, setData] = useState<BatchesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  const fetchBatches = useCallback(
    async (token: string, currentPage: number) => {
      const params = new URLSearchParams({
        offset: String((currentPage - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      const res = await fetch(`/api/admin/pipeline/batches?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || 'Failed to load batches');
        setLoading(false);
        return;
      }
      setData(await res.json());
      setError(null);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        setLoading(false);
        return;
      }
      setToken(session.access_token);
      fetchBatches(session.access_token, page);
    }
    load();
  }, [page, fetchBatches]);

  if (loading) return <p>Loading...</p>;
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  if (!data) return null;

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {data.batches.length === 0 ? (
        <p className="text-sm text-gray-500">
          No batch runs yet. Approve some shops to create a batch.
        </p>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              <th className="pb-2">Date</th>
              <th className="pb-2">Shops</th>
              <th className="pb-2">Status Breakdown</th>
            </tr>
          </thead>
          <tbody>
            {data.batches.map((batch) => (
              <Fragment key={batch.batch_id}>
                <tr
                  className="cursor-pointer border-b hover:bg-gray-50"
                  onClick={() =>
                    setExpandedBatchId(
                      expandedBatchId === batch.batch_id ? null : batch.batch_id
                    )
                  }
                >
                  <td className="py-2 text-gray-500">
                    {new Date(batch.created_at).toLocaleString()}
                  </td>
                  <td className="py-2">{batch.shop_count}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(batch.status_counts).map(
                        ([status, count]) => (
                          <span
                            key={status}
                            className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}
                          >
                            {status}: {count}
                          </span>
                        )
                      )}
                    </div>
                  </td>
                </tr>
                {expandedBatchId === batch.batch_id && token && (
                  <tr className="border-b bg-gray-50">
                    <td colSpan={3} className="px-4 py-3">
                      <BatchDetail
                        batchId={batch.batch_id}
                        token={token}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
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
