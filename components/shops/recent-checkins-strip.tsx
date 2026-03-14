'use client';
import { useUser } from '@/lib/hooks/use-user';

interface CheckinPreview {
  count: number;
  previewPhotoUrl: string | null;
}

interface CheckinItem {
  id: string;
  displayName: string | null;
  photoUrl: string;
  createdAt: string;
}

interface RecentCheckinsStripProps {
  preview: CheckinPreview;
  checkins: CheckinItem[];
}

export function RecentCheckinsStrip({
  preview,
  checkins,
}: RecentCheckinsStripProps) {
  const { user } = useUser();

  if (preview.count === 0) return null;

  return (
    <div className="px-4 py-3">
      <h3 className="mb-2 text-sm font-medium text-gray-900">
        最近打卡 ({preview.count})
      </h3>
      {user && checkins.length > 0 ? (
        <div className="scrollbar-hide flex gap-3 overflow-x-auto">
          {checkins.map((ci) => (
            <div key={ci.id} className="flex-shrink-0 text-center">
              <img
                src={ci.photoUrl}
                alt={`Check-in by ${ci.displayName ?? 'user'}`}
                className="h-16 w-16 rounded-lg object-cover"
              />
              <p className="mt-1 text-xs text-gray-500">
                {ci.displayName ?? '匿名'}
              </p>
            </div>
          ))}
        </div>
      ) : (
        preview.previewPhotoUrl && (
          <img
            src={preview.previewPhotoUrl}
            alt="Recent check-in"
            className="h-16 w-16 rounded-lg object-cover"
          />
        )
      )}
    </div>
  );
}
