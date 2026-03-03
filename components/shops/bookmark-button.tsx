'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { SaveToListSheet } from '@/components/lists/save-to-list-sheet';

interface BookmarkButtonProps {
  shopId: string;
  className?: string;
}

export function BookmarkButton({ shopId, className }: BookmarkButtonProps) {
  const { isSaved } = useUserLists();
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const saved = isSaved(shopId);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push(`/login?next=${encodeURIComponent(`/shops/${shopId}`)}`);
      return;
    }
    setSheetOpen(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={className}
        aria-label={saved ? 'Saved to list' : 'Save to list'}
      >
        <Bookmark
          className={`h-5 w-5 ${saved ? 'fill-current text-amber-500' : 'text-gray-400'}`}
        />
      </button>
      <SaveToListSheet
        shopId={shopId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
