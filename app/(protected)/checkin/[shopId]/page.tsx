'use client';

import { useCallback, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PhotoUploader } from '@/components/checkins/photo-uploader';
import { fetchWithAuth } from '@/lib/api/fetch';
import { uploadCheckInPhoto, uploadMenuPhoto } from '@/lib/supabase/storage';

type SubmitState = 'idle' | 'uploading' | 'submitting';

export default function CheckInPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const router = useRouter();

  const { data: shop } = useSWR(
    shopId ? `/api/shops/${shopId}` : null,
    (url) => fetch(url).then((r) => r.json())
  );

  const [photos, setPhotos] = useState<File[]>([]);
  const [menuPhoto, setMenuPhoto] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [submitState, setSubmitState] = useState<SubmitState>('idle');
  const [menuOpen, setMenuOpen] = useState(false);

  const canSubmit = photos.length > 0 && submitState === 'idle';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    try {
      setSubmitState('uploading');

      const photoUrls = await Promise.all(photos.map(uploadCheckInPhoto));
      const menuPhotoUrl = menuPhoto ? await uploadMenuPhoto(menuPhoto) : undefined;

      setSubmitState('submitting');

      await fetchWithAuth('/api/checkins', {
        method: 'POST',
        body: JSON.stringify({
          shop_id: shopId,
          photo_urls: photoUrls,
          menu_photo_url: menuPhotoUrl ?? null,
          note: note.trim() || null,
        }),
      });

      toast('打卡成功！Stamp earned.', {
        description: shop?.name ?? 'Check-in recorded',
        action: {
          label: 'View Collection',
          onClick: () => router.push('/profile'),
        },
      });
      router.back();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Check-in failed. Try again.'
      );
    } finally {
      setSubmitState('idle');
    }
  }, [canSubmit, photos, menuPhoto, note, shopId, shop, router]);

  return (
    <main className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="mb-2 text-sm text-gray-500 hover:text-gray-700"
        >
          ← {shop?.name ?? 'Back'}
        </button>
        <h1 className="text-xl font-bold">Check In</h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
        className="space-y-6"
      >
        <PhotoUploader files={photos} onChange={setPhotos} />

        <div>
          <label htmlFor="note" className="mb-1 block text-sm font-medium text-gray-700">
            Note <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            id="note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did you have? 今天點了什麼？"
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-1 text-sm text-gray-600"
          >
            <span className={`transition-transform ${menuOpen ? 'rotate-90' : ''}`}>
              ▸
            </span>
            Menu photo <span className="text-gray-400">(optional)</span>
          </button>
          {menuOpen && (
            <div className="mt-2 space-y-2">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setMenuPhoto(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-500 file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm"
              />
              {menuPhoto && (
                <img
                  src={URL.createObjectURL(menuPhoto)}
                  alt="Menu photo preview"
                  className="h-20 w-20 rounded object-cover"
                />
              )}
            </div>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Menu photos may be used to improve shop information on CafeRoam.
          </p>
        </div>

        <Button
          type="submit"
          disabled={!canSubmit}
          className="w-full"
        >
          {submitState === 'uploading'
            ? 'Uploading photos...'
            : submitState === 'submitting'
              ? 'Saving...'
              : '打卡 Check In'}
        </Button>
      </form>
    </main>
  );
}
