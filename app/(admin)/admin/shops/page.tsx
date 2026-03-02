'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Shop {
  id: string;
  name: string;
  address: string;
  processing_status: string;
  source: string;
  enriched_at: string | null;
  tag_count: number;
  has_embedding: boolean;
}

interface ShopsResponse {
  shops: Shop[];
  total: number;
}

interface ImportSummary {
  imported: number;
  filtered: {
    invalid_url: number;
    invalid_name: number;
    known_failed: number;
    closed: number;
  };
  pending_url_check: number;
  flagged_duplicates: number;
  region: string;
}

const REGIONS = [
  { value: 'greater_taipei', label: 'Greater Taipei (大台北)' },
] as const;

const STATUS_OPTIONS = [
  'all',
  'pending',
  'pending_url_check',
  'pending_review',
  'scraping',
  'enriching',
  'embedding',
  'publishing',
  'live',
  'failed',
  'filtered_dead_url',
] as const;
const SOURCE_OPTIONS = [
  'all',
  'cafe_nomad',
  'manual',
  'google_takeout',
  'user_submission',
] as const;
const PAGE_SIZE = 20;

async function getAuthToken(): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

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

  // Import section state
  const [selectedRegion, setSelectedRegion] = useState<string>(
    REGIONS[0].value
  );
  const [importingCafeNomad, setImportingCafeNomad] = useState(false);
  const [importingTakeout, setImportingTakeout] = useState(false);
  const [checkingUrls, setCheckingUrls] = useState(false);
  const takeoutFileRef = useRef<HTMLInputElement>(null);

  // Bulk approve state
  const [selectedShopIds, setSelectedShopIds] = useState<Set<string>>(
    new Set()
  );
  const [approvingBulk, setApprovingBulk] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchShops = useCallback(
    async (
      searchTerm: string,
      status: string,
      source: string,
      currentOffset: number
    ) => {
      setLoading(true);
      setError(null);

      try {
        const token = await getAuthToken();
        if (!token) {
          setError('Session expired — please refresh the page');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams();
        if (searchTerm) params.set('search', searchTerm);
        if (status !== 'all') params.set('processing_status', status);
        if (source !== 'all') params.set('source', source);
        params.set('offset', String(currentOffset));
        params.set('limit', String(PAGE_SIZE));

        const queryString = params.toString();
        const url = `/api/admin/shops${queryString ? `?${queryString}` : ''}`;

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
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

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedShopIds(new Set());
  }, [statusFilter, sourceFilter, appliedSearch, offset]);

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

  function toggleShopSelection(shopId: string) {
    setSelectedShopIds((prev) => {
      const next = new Set(prev);
      if (next.has(shopId)) {
        next.delete(shopId);
      } else {
        next.add(shopId);
      }
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedShopIds.size === shops.length) {
      setSelectedShopIds(new Set());
    } else {
      setSelectedShopIds(new Set(shops.map((s) => s.id)));
    }
  }

  async function handleImportCafeNomad() {
    setImportingCafeNomad(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Session expired — please refresh the page');
        return;
      }
      const res = await fetch('/api/admin/shops/import/cafe-nomad', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ region: selectedRegion }),
      });
      const data: ImportSummary = await res.json();
      if (!res.ok) {
        toast.error((data as { detail?: string }).detail || 'Import failed');
        return;
      }
      toast.success(
        `Imported ${data.imported} shops (${data.flagged_duplicates} flagged as duplicates)`
      );
      fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
    } catch {
      toast.error('Network error');
    } finally {
      setImportingCafeNomad(false);
    }
  }

  async function handleImportTakeout() {
    const file = takeoutFileRef.current?.files?.[0];
    if (!file) {
      toast.error('Please select a GeoJSON file first');
      return;
    }

    setImportingTakeout(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Session expired — please refresh the page');
        return;
      }
      const formData = new FormData();
      formData.append('file', file);
      formData.append('region', selectedRegion);

      const res = await fetch('/api/admin/shops/import/google-takeout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data: ImportSummary = await res.json();
      if (!res.ok) {
        toast.error((data as { detail?: string }).detail || 'Upload failed');
        return;
      }
      toast.success(
        `Imported ${data.imported} shops from Google Takeout (${data.flagged_duplicates} flagged as duplicates)`
      );
      if (takeoutFileRef.current) takeoutFileRef.current.value = '';
      fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
    } catch {
      toast.error('Network error');
    } finally {
      setImportingTakeout(false);
    }
  }

  async function handleCheckUrls() {
    setCheckingUrls(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Session expired — please refresh the page');
        return;
      }
      const res = await fetch('/api/admin/shops/import/check-urls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'URL check failed');
        return;
      }
      toast.success(`URL check started for ${data.checking} shops`);
    } catch {
      toast.error('Network error');
    } finally {
      setCheckingUrls(false);
    }
  }

  async function handleBulkApprove(approveAll: boolean) {
    setApprovingBulk(true);
    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Session expired — please refresh the page');
        return;
      }
      const body = approveAll ? {} : { shop_ids: Array.from(selectedShopIds) };

      const res = await fetch('/api/admin/shops/bulk-approve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.detail || 'Bulk approve failed');
        return;
      }
      toast.success(
        `Approved ${data.approved} shops, queued ${data.queued} scrape jobs`
      );
      setSelectedShopIds(new Set());
      fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
    } catch {
      toast.error('Network error');
    } finally {
      setApprovingBulk(false);
    }
  }

  async function handleCreateShop(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);

    const formData = new FormData(e.currentTarget);
    const latitude = parseFloat(formData.get('latitude') as string);
    const longitude = parseFloat(formData.get('longitude') as string);

    if (isNaN(latitude) || isNaN(longitude)) {
      toast.error('Latitude and longitude must be valid numbers');
      setCreateLoading(false);
      return;
    }

    const payload = {
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      latitude,
      longitude,
    };

    try {
      const token = await getAuthToken();
      if (!token) {
        toast.error('Session expired — please refresh the page');
        setCreateLoading(false);
        return;
      }
      const res = await fetch('/api/admin/shops', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.detail || 'Failed to create shop');
        return;
      }

      toast.success('Shop created');
      setShowCreateForm(false);
      fetchShops(appliedSearch, statusFilter, sourceFilter, offset);
    } catch {
      toast.error('Network error');
    } finally {
      setCreateLoading(false);
    }
  }

  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;
  const isReviewFilter = statusFilter === 'pending_review';

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

      {/* Import Section */}
      <div className="space-y-3 rounded-lg border p-4">
        <h2 className="text-sm font-semibold text-gray-700">Import Shops</h2>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label htmlFor="region-select" className="sr-only">
              Region
            </label>
            <select
              id="region-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="rounded border px-3 py-1.5 text-sm"
            >
              {REGIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleImportCafeNomad}
            disabled={importingCafeNomad}
            className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {importingCafeNomad ? 'Importing...' : 'Import from Cafe Nomad'}
          </button>

          <div className="flex items-center gap-2">
            <input
              ref={takeoutFileRef}
              type="file"
              accept=".json,.geojson"
              className="text-sm"
              id="takeout-file"
            />
            <button
              type="button"
              onClick={handleImportTakeout}
              disabled={importingTakeout}
              className="rounded bg-green-700 px-3 py-1.5 text-sm text-white hover:bg-green-800 disabled:opacity-50"
            >
              {importingTakeout ? 'Uploading...' : 'Import Google Takeout'}
            </button>
          </div>

          <button
            type="button"
            onClick={handleCheckUrls}
            disabled={checkingUrls}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {checkingUrls ? 'Checking...' : 'Check URLs'}
          </button>
        </div>
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

      {/* Bulk approve bar — shown only when filtering by pending_review */}
      {isReviewFilter && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2">
          <span className="text-sm text-amber-800">
            {selectedShopIds.size} selected
          </span>
          <button
            type="button"
            onClick={() => handleBulkApprove(false)}
            disabled={approvingBulk || selectedShopIds.size === 0}
            className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Approve Selected
          </button>
          <button
            type="button"
            onClick={() => handleBulkApprove(true)}
            disabled={approvingBulk}
            className="rounded border border-amber-400 px-3 py-1 text-sm text-amber-700 hover:bg-amber-100 disabled:opacity-50"
          >
            Approve All
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {!error && (
        <>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                {isReviewFilter && (
                  <th className="pr-2 pb-2">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        shops.length > 0 &&
                        selectedShopIds.size === shops.length
                      }
                      onChange={handleSelectAll}
                    />
                  </th>
                )}
                <th className="pb-2">Name</th>
                <th className="pb-2">Address</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Source</th>
                <th className="pb-2">Tags</th>
                <th className="pb-2">Embedding</th>
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
                  {isReviewFilter && (
                    <td
                      className="py-2 pr-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        aria-label={`Select ${shop.name}`}
                        checked={selectedShopIds.has(shop.id)}
                        onChange={() => toggleShopSelection(shop.id)}
                      />
                    </td>
                  )}
                  <td className="py-2">{shop.name}</td>
                  <td className="py-2 text-gray-600">{shop.address}</td>
                  <td className="py-2">{shop.processing_status}</td>
                  <td className="py-2 text-gray-500">{shop.source}</td>
                  <td className="py-2 text-gray-500">{shop.tag_count}</td>
                  <td className="py-2 text-gray-500">
                    {shop.has_embedding ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
                        yes
                      </span>
                    ) : (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
                        no
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-gray-500">
                    {shop.enriched_at
                      ? new Date(shop.enriched_at).toLocaleDateString()
                      : '—'}
                  </td>
                </tr>
              ))}
              {!loading && shops.length === 0 && (
                <tr>
                  <td
                    colSpan={isReviewFilter ? 8 : 7}
                    className="py-8 text-center text-gray-400"
                  >
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
