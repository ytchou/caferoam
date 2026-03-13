'use client';
import Link from 'next/link';

interface StickyCheckinBarProps {
  shopId: string;
  returnTo: string;
}

export function StickyCheckinBar({ shopId, returnTo }: StickyCheckinBarProps) {
  return (
    <div className="pb-safe fixed right-0 bottom-0 left-0 z-30 border-t border-gray-100 bg-white p-4">
      <Link
        href={`/checkin/${shopId}?returnTo=${encodeURIComponent(returnTo)}`}
        className="block w-full rounded-full bg-[#E06B3F] py-3 text-center font-medium text-white"
      >
        打卡記錄 Check In →
      </Link>
    </div>
  );
}
