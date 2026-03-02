'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TagFrequency {
  tag_id: string;
  shop_count: number;
  avg_confidence: number;
  dimension: string;
}

interface LowConfidenceShop {
  id: string;
  name: string;
  max_confidence: number;
}

interface MissingEmbeddingShop {
  id: string;
  name: string;
  processing_status: string;
}

interface TaxonomyStats {
  total_shops: number;
  shops_with_tags: number;
  shops_with_embeddings: number;
  shops_missing_tags: number;
  shops_missing_embeddings: number;
  tag_frequency: TagFrequency[];
  low_confidence_shops: LowConfidenceShop[];
  missing_embeddings: MissingEmbeddingShop[];
}

function pct(part: number, total: number): string {
  if (total === 0) return '0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function confidenceColor(value: number): string {
  if (value < 0.3) return 'text-red-600';
  if (value < 0.4) return 'text-orange-500';
  return 'text-yellow-600';
}

type SortKey = keyof Pick<
  TagFrequency,
  'tag_id' | 'dimension' | 'shop_count' | 'avg_confidence'
>;
type SortDir = 'asc' | 'desc';

export default function TaxonomyPage() {
  const [data, setData] = useState<TaxonomyStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>('shop_count');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch('/api/admin/taxonomy/stats', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.detail || 'Failed to load taxonomy stats');
        setLoading(false);
        return;
      }
      setData(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <p>Loading...</p>;
  if (error)
    return (
      <p role="alert" className="text-red-600">
        {error}
      </p>
    );
  if (!data) return null;

  const missingCoverage =
    data.shops_missing_tags + data.shops_missing_embeddings;

  const sortedTags = [...data.tag_frequency].sort((a, b) => {
    const av = a[sortKey] ?? '';
    const bv = b[sortKey] ?? '';
    const cmp = av < bv ? -1 : av > bv ? 1 : 0;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Taxonomy Coverage</h1>

      <section>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">Total Shops</p>
            <p className="text-2xl font-bold">{data.total_shops}</p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">With Tags</p>
            <p className="text-2xl font-bold">{data.shops_with_tags}</p>
            <p className="text-sm text-green-600">
              {pct(data.shops_with_tags, data.total_shops)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">With Embeddings</p>
            <p className="text-2xl font-bold">{data.shops_with_embeddings}</p>
            <p className="text-sm text-green-600">
              {pct(data.shops_with_embeddings, data.total_shops)}
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <p className="text-sm text-gray-500">Missing Coverage</p>
            <p className="text-2xl font-bold">{missingCoverage}</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Tag Frequency</h2>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b text-gray-500">
              {(
                [
                  ['tag_id', 'Tag ID'],
                  ['dimension', 'Dimension'],
                  ['shop_count', 'Shop Count'],
                  ['avg_confidence', 'Avg Confidence'],
                ] as [SortKey, string][]
              ).map(([key, label]) => (
                <th
                  key={key}
                  className="cursor-pointer pb-2 select-none hover:text-gray-800"
                  onClick={() => handleSort(key)}
                >
                  {label}
                  {sortKey === key && (
                    <span className="ml-1 text-xs">
                      {sortDir === 'asc' ? '↑' : '↓'}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedTags.map((tag) => (
              <tr key={tag.tag_id} className="border-b">
                <td className="py-2">{tag.tag_id}</td>
                <td className="py-2 text-gray-500">{tag.dimension}</td>
                <td className="py-2">{tag.shop_count}</td>
                <td className="py-2">
                  {tag.avg_confidence?.toFixed(2) ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Low Confidence Shops</h2>
        {data.low_confidence_shops.length === 0 ? (
          <p className="text-gray-500">No low confidence shops.</p>
        ) : (
          <ul className="space-y-2">
            {data.low_confidence_shops.map((shop) => (
              <li
                key={shop.id}
                className="flex items-center justify-between rounded border px-4 py-2"
              >
                <span>{shop.name}</span>
                <span
                  className={`font-mono text-sm ${confidenceColor(shop.max_confidence)}`}
                >
                  {shop.max_confidence.toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Missing Embeddings</h2>
        {data.missing_embeddings.length === 0 ? (
          <p className="text-gray-500">All shops have embeddings.</p>
        ) : (
          <ul className="space-y-2">
            {data.missing_embeddings.map((shop) => (
              <li
                key={shop.id}
                className="flex items-center justify-between rounded border px-4 py-2"
              >
                <span>{shop.name}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {shop.processing_status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
