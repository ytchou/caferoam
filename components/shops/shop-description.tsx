'use client';
import { useState } from 'react';

interface ShopDescriptionProps {
  text: string;
}

export function ShopDescription({ text }: ShopDescriptionProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className="px-4 py-2">
      <p
        className={`text-sm text-gray-600 ${expanded ? '' : 'line-clamp-2'}`}
      >
        {text}
      </p>
      {!expanded && text.length > 60 && (
        <button
          onClick={() => setExpanded(true)}
          className="mt-1 text-sm font-medium text-[#E06B3F]"
        >
          更多
        </button>
      )}
    </div>
  );
}
