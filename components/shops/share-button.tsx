'use client';

import { useAnalytics } from '@/lib/posthog/use-analytics';

interface ShareButtonProps {
  shopId: string;
  shopName: string;
  shareUrl: string;
}

export function ShareButton({ shopId, shopName, shareUrl }: ShareButtonProps) {
  const { capture } = useAnalytics();

  const handleShare = async () => {
    const shareData = { title: shopName, url: shareUrl };

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share(shareData);
        capture('shop_url_copied', {
          shop_id: shopId,
          copy_method: 'native_share',
        });
        return;
      } catch {
        // Fall through to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        capture('shop_url_copied', {
          shop_id: shopId,
          copy_method: 'clipboard',
        });
      } catch {
        // Clipboard unavailable (permission denied or non-secure context)
      }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label="分享"
      className="flex items-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden="true"
      >
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      分享
    </button>
  );
}
