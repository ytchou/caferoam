'use client';

import { Fragment, useEffect, useState, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Job {
  id: string;
  job_type: string;
  status: string;
  priority: number;
  attempts: number;
  created_at: string;
  last_error: string | null;
  payload: Record<string, unknown>;
}

interface JobsResponse {
  jobs: Job[];
  total: number;
}

const STATUS_OPTIONS = [
  'all',
  'pending',
  'claimed',
  'completed',
  'failed',
  'dead_letter',
] as const;

const JOB_TYPE_OPTIONS = [
  'all',
  'enrich_shop',
  'generate_embedding',
  'scrape_shop',
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  claimed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  dead_letter: 'bg-gray-100 text-gray-700',
};

const PAGE_SIZE = 20;

export default function AdminJobsPage() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const tokenRef = useRef<string | null>(null);

  const fetchJobs = useCallback(
    async (
      token: string,
      currentPage: number,
      status: string,
      jobType: string
    ) => {
      const params = new URLSearchParams({
        offset: String((currentPage - 1) * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      });
      if (status !== 'all') params.set('status', status);
      if (jobType !== 'all') params.set('job_type', jobType);

      const res = await fetch(`/api/admin/pipeline/jobs?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || 'Failed to load jobs');
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
      if (!session) return;

      tokenRef.current = session.access_token;
      fetchJobs(session.access_token, page, statusFilter, typeFilter);
    }
    load();
  }, [page, statusFilter, typeFilter, fetchJobs]);

  async function handleCancel(jobId: string) {
    if (!tokenRef.current) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/pipeline/jobs/${jobId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.detail || 'Failed to cancel job');
        return;
      }
      fetchJobs(tokenRef.current, page, statusFilter, typeFilter);
    } catch {
      setActionError('Network error');
    }
  }

  async function handleRetry(jobId: string) {
    if (!tokenRef.current) return;
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/pipeline/retry/${jobId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenRef.current}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionError(body.detail || 'Failed to retry job');
        return;
      }
      fetchJobs(tokenRef.current, page, statusFilter, typeFilter);
    } catch {
      setActionError('Network error');
    }
  }

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
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Jobs Queue</h1>

      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm">
          Status:
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-sm">
          Type:
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded border px-2 py-1"
          >
            {JOB_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {actionError && (
        <p
          role="alert"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-2">Type</th>
            <th className="pb-2">Status</th>
            <th className="pb-2">Priority</th>
            <th className="pb-2">Attempts</th>
            <th className="pb-2">Created</th>
            <th className="pb-2">Error</th>
            <th className="pb-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {data.jobs.map((job) => (
            <Fragment key={job.id}>
              <tr
                className="cursor-pointer border-b hover:bg-gray-50"
                onClick={() =>
                  setExpandedJobId(expandedJobId === job.id ? null : job.id)
                }
              >
                <td className="py-2">{job.job_type}</td>
                <td className="py-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[job.status] || 'bg-gray-100 text-gray-700'}`}
                  >
                    {job.status}
                  </span>
                </td>
                <td className="py-2">{job.priority}</td>
                <td className="py-2">{job.attempts}</td>
                <td className="py-2 text-gray-500">
                  {new Date(job.created_at).toLocaleDateString()}
                </td>
                <td className="max-w-xs truncate py-2 text-gray-500">
                  {job.last_error
                    ? job.last_error.slice(0, 60) +
                      (job.last_error.length > 60 ? '...' : '')
                    : '-'}
                </td>
                <td className="py-2">
                  {(job.status === 'pending' || job.status === 'claimed') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCancel(job.id);
                      }}
                      className="rounded bg-red-50 px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      Cancel
                    </button>
                  )}
                  {(job.status === 'failed' ||
                    job.status === 'dead_letter') && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRetry(job.id);
                      }}
                      className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-600 hover:bg-blue-100"
                    >
                      Retry
                    </button>
                  )}
                </td>
              </tr>
              {expandedJobId === job.id && (
                <tr className="border-b bg-gray-50">
                  <td colSpan={7} className="px-4 py-3">
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-semibold text-gray-500">
                          Payload
                        </p>
                        <pre className="mt-1 overflow-auto rounded bg-white p-2 text-xs">
                          {JSON.stringify(job.payload, null, 2)}
                        </pre>
                      </div>
                      {job.last_error && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500">
                            Full Error
                          </p>
                          <pre className="mt-1 overflow-auto rounded bg-white p-2 text-xs text-red-600">
                            {job.last_error}
                          </pre>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>

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
