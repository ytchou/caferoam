"use client";
import Link from "next/link";

interface StickyCheckinBarProps {
  shopId: string;
  returnTo: string;
}

export function StickyCheckinBar({ shopId, returnTo }: StickyCheckinBarProps) {
  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 pb-safe z-30">
      <Link
        href={`/checkin/${shopId}?returnTo=${encodeURIComponent(returnTo)}`}
        className="block w-full py-3 text-center bg-[#E06B3F] text-white font-medium rounded-full"
      >
        打卡記錄 Check In →
      </Link>
    </div>
  );
}
