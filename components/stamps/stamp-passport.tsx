'use client';

import { useMemo, useRef, useState } from 'react';
import type { StampData } from '@/lib/hooks/use-user-stamps';

const SLOTS_PER_PAGE = 20;
const COLS = 4;

interface StampPassportProps {
  stamps: StampData[];
}

export function StampPassport({ stamps }: StampPassportProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const pages = useMemo(() => {
    const totalPages = Math.max(1, Math.ceil(stamps.length / SLOTS_PER_PAGE));
    return Array.from({ length: totalPages }, (_, pageIdx) => {
      const pageStamps = stamps.slice(
        pageIdx * SLOTS_PER_PAGE,
        (pageIdx + 1) * SLOTS_PER_PAGE
      );
      const slots: (StampData | null)[] = [
        ...pageStamps,
        ...Array(SLOTS_PER_PAGE - pageStamps.length).fill(null),
      ];
      return slots;
    });
  }, [stamps]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">My Passport</h2>
        <span className="text-sm text-gray-500">
          {stamps.length} {stamps.length === 1 ? 'stamp' : 'stamps'}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto"
        style={{ scrollbarWidth: 'none' }}
      >
        {pages.map((slots, pageIdx) => (
          <div
            key={pageIdx}
            className="min-w-full snap-center"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
              gap: '0.5rem',
            }}
          >
            {slots.map((stamp, slotIdx) =>
              stamp ? (
                <div
                  key={stamp.id}
                  data-testid="stamp-slot-filled"
                  className="flex aspect-square items-center justify-center rounded-lg bg-amber-50 p-1"
                >
                  <img
                    src={stamp.design_url}
                    alt="Stamp"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : (
                <div
                  key={`empty-${pageIdx}-${slotIdx}`}
                  data-testid="stamp-slot-empty"
                  className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-200"
                >
                  <div className="h-8 w-8 rounded-full border-2 border-gray-200" />
                </div>
              )
            )}
          </div>
        ))}
      </div>

      {pages.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {pages.map((_, i) => (
            <button
              key={i}
              data-testid="page-dot"
              onClick={() => {
                setCurrentPage(i);
                scrollRef.current?.scrollTo({
                  left: i * scrollRef.current.offsetWidth,
                  behavior: 'smooth',
                });
              }}
              className={`h-2 w-2 rounded-full ${
                i === currentPage ? 'bg-gray-800' : 'bg-gray-300'
              }`}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
