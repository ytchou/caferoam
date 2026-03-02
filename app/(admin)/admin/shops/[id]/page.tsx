'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface ModeScores {
  work: number;
  rest: number;
  social: number;
}

interface Tag {
  tag_id: string;
  confidence: number;
}

interface Photo {
  url: string;
  category: string;
  is_menu: boolean;
}

interface ShopDetail {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  processing_status: string;
  source: string;
  description?: string;
  mode_scores?: ModeScores;
  tags?: Tag[];
  photos?: Photo[];
}

export default function AdminShopDetail() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/admin/shops/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || 'Failed to load shop');
        setLoading(false);
        return;
      }
      // Backend returns { shop: {...}, tags: [...], photos: [...] }
      const { shop: shopData, tags, photos } = await res.json();
      setShop({ ...shopData, tags, photos });
      setEditForm({
        name: shopData.name,
        address: shopData.address,
        latitude: String(shopData.latitude),
        longitude: String(shopData.longitude),
      });
      setLoading(false);
    }
    load();
  }, [id]);

  async function getToken() {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  }

  async function handleEnqueue(jobType: string) {
    const token = await getToken();
    if (!token) return;
    setActionStatus(`Enqueuing ${jobType}...`);
    try {
      const res = await fetch(`/api/admin/shops/${id}/enqueue`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ job_type: jobType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionStatus(`Error: ${body.detail || 'Failed to enqueue'}`);
        return;
      }
      setActionStatus(`${jobType} job enqueued`);
    } catch {
      setActionStatus('Network error');
    }
  }

  async function handleToggleLive() {
    const token = await getToken();
    if (!token || !shop) return;
    const newStatus = shop.processing_status === 'live' ? 'pending' : 'live';
    setActionStatus(`Setting status to ${newStatus}...`);
    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ processing_status: newStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActionStatus(`Error: ${body.detail || 'Failed to update status'}`);
        return;
      }
      const updated = await res.json();
      setShop((prev) => (prev ? { ...prev, ...updated } : null));
      setActionStatus(`Status set to ${newStatus}`);
    } catch {
      setActionStatus('Network error');
    }
  }

  async function handleSearchRank() {
    if (!searchQuery.trim()) return;
    const token = await getToken();
    if (!token) return;
    setSearchResult('Searching...');
    try {
      const res = await fetch(
        `/api/admin/shops/${id}/search-rank?query=${encodeURIComponent(searchQuery)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        setSearchResult('Error fetching rank');
        return;
      }
      const data = await res.json();
      if (data.found) {
        setSearchResult(`Rank: ${data.rank} of ${data.total_results}`);
      } else {
        setSearchResult(
          `Not ranked (checked top ${data.total_results} results)`
        );
      }
    } catch {
      setSearchResult('Network error');
    }
  }

  async function handleSaveEdit() {
    const token = await getToken();
    if (!token) return;
    setEditError(null);

    const lat = parseFloat(editForm.latitude);
    const lng = parseFloat(editForm.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      setEditError('Latitude and longitude must be valid numbers');
      return;
    }

    try {
      const res = await fetch(`/api/admin/shops/${id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          address: editForm.address,
          latitude: lat,
          longitude: lng,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setShop((prev) => (prev ? { ...prev, ...updated } : null));
        setEditing(false);
      } else {
        const body = await res.json().catch(() => ({}));
        setEditError(body.detail || 'Failed to save changes');
      }
    } catch {
      setEditError('Network error');
    }
  }

  if (loading) return <p>Loading...</p>;
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  if (!shop) return null;

  function confidenceColor(c: number) {
    if (c > 0.7) return 'bg-green-500';
    if (c > 0.4) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function modeBarWidth(score: number) {
    return `${Math.round(score * 100)}%`;
  }

  return (
    <div className="space-y-8">
      {/* Shop Identity */}
      <section>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{shop.name}</h1>
            <p className="mt-1 text-gray-600">{shop.address}</p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  shop.processing_status === 'live'
                    ? 'bg-green-100 text-green-700'
                    : shop.processing_status === 'failed'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                }`}
              >
                {shop.processing_status}
              </span>
              <span className="text-gray-500">{shop.source}</span>
              <span className="text-gray-400">
                {shop.latitude}, {shop.longitude}
              </span>
            </div>
          </div>
          <button
            onClick={() => setEditing(!editing)}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            {editing ? 'Cancel' : 'Edit'}
          </button>
        </div>

        {editing && (
          <div className="mt-4 rounded border bg-gray-50 p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="edit-name"
                  className="block text-sm font-medium"
                >
                  Name
                </label>
                <input
                  id="edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) =>
                    setEditForm({ ...editForm, name: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="edit-address"
                  className="block text-sm font-medium"
                >
                  Address
                </label>
                <input
                  id="edit-address"
                  type="text"
                  value={editForm.address}
                  onChange={(e) =>
                    setEditForm({ ...editForm, address: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-lat" className="block text-sm font-medium">
                  Latitude
                </label>
                <input
                  id="edit-lat"
                  type="text"
                  value={editForm.latitude}
                  onChange={(e) =>
                    setEditForm({ ...editForm, latitude: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
              <div>
                <label htmlFor="edit-lng" className="block text-sm font-medium">
                  Longitude
                </label>
                <input
                  id="edit-lng"
                  type="text"
                  value={editForm.longitude}
                  onChange={(e) =>
                    setEditForm({ ...editForm, longitude: e.target.value })
                  }
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                />
              </div>
            </div>
            {editError && (
              <p className="mt-2 text-sm text-red-600">{editError}</p>
            )}
            <button
              onClick={handleSaveEdit}
              className="mt-3 rounded bg-blue-600 px-4 py-1 text-sm text-white hover:bg-blue-700"
            >
              Save
            </button>
          </div>
        )}
      </section>

      {/* Enrichment — Mode Scores */}
      {shop.mode_scores && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Enrichment</h2>
          {shop.description && (
            <p className="mb-4 text-sm text-gray-600">{shop.description}</p>
          )}
          <div className="space-y-3">
            {(['work', 'rest', 'social'] as const).map((mode) => (
              <div key={mode} className="flex items-center gap-3">
                <span className="w-14 text-sm font-medium capitalize">
                  {mode}
                </span>
                <div className="h-4 flex-1 rounded bg-gray-200">
                  <div
                    className={`h-4 rounded ${
                      mode === 'work'
                        ? 'bg-blue-500'
                        : mode === 'rest'
                          ? 'bg-green-500'
                          : 'bg-purple-500'
                    }`}
                    style={{ width: modeBarWidth(shop.mode_scores![mode]) }}
                  />
                </div>
                <span className="w-10 text-right text-sm text-gray-500">
                  {(shop.mode_scores![mode] * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tags */}
      {shop.tags && shop.tags.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Tags</h2>
          <div className="space-y-2">
            {shop.tags.map((t) => (
              <div key={t.tag_id} className="flex items-center gap-3">
                <span className="w-40 text-sm">{t.tag_id}</span>
                <div className="h-3 flex-1 rounded bg-gray-200">
                  <div
                    className={`h-3 rounded ${confidenceColor(t.confidence)}`}
                    style={{ width: `${Math.round(t.confidence * 100)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-sm text-gray-500">
                  {t.confidence.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Photos */}
      {shop.photos && shop.photos.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Photos</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {shop.photos.map((photo, idx) => (
              <div key={idx} className="overflow-hidden rounded border">
                <img
                  src={photo.url}
                  alt={`${photo.category} photo`}
                  className="h-40 w-full object-cover"
                />
                <div className="flex items-center justify-between p-2 text-xs text-gray-500">
                  <span>{photo.category}</span>
                  {photo.is_menu && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                      menu
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Actions Bar */}
      <section>
        <h2 className="mb-4 text-lg font-semibold">Actions</h2>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => handleEnqueue('enrich_shop')}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Re-enrich
          </button>
          <button
            onClick={() => handleEnqueue('generate_embedding')}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Re-embed
          </button>
          <button
            onClick={() => handleEnqueue('scrape_shop')}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Re-scrape
          </button>
          <button
            onClick={handleToggleLive}
            className={`rounded border px-3 py-1 text-sm ${
              shop.processing_status === 'live'
                ? 'border-red-300 text-red-600 hover:bg-red-50'
                : 'border-green-300 text-green-600 hover:bg-green-50'
            }`}
          >
            {shop.processing_status === 'live' ? 'Unpublish' : 'Set Live'}
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <input
            type="text"
            placeholder="Search query..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
          />
          <button
            onClick={handleSearchRank}
            className="rounded border px-3 py-1 text-sm hover:bg-gray-50"
          >
            Test Search
          </button>
          {searchResult && (
            <span className="text-sm text-gray-600">{searchResult}</span>
          )}
        </div>

        {actionStatus && (
          <p className="mt-2 text-sm text-gray-600">{actionStatus}</p>
        )}
      </section>
    </div>
  );
}
