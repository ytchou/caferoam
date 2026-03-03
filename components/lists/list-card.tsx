'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface ListCardProps {
  id: string;
  name: string;
  itemCount: number;
  onRename: () => void;
  onDelete: () => void;
}

export function ListCard({
  id,
  name,
  itemCount,
  onRename,
  onDelete,
}: ListCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-md">
      <Link href={`/lists/${id}`} className="block">
        <h3 className="font-medium text-gray-900">{name}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {itemCount} {itemCount === 1 ? 'shop' : 'shops'}
        </p>
      </Link>

      {/* Desktop: show on hover */}
      <div className="absolute top-2 right-2 hidden gap-1 group-hover:flex">
        <button
          onClick={(e) => {
            e.preventDefault();
            onRename();
          }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Rename list"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            onDelete();
          }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
          aria-label="Delete list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile: always visible menu */}
      <div ref={menuRef} className="absolute top-2 right-2 group-hover:hidden">
        <button
          onClick={(e) => {
            e.preventDefault();
            setMenuOpen(!menuOpen);
          }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="List menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute top-8 right-0 z-10 min-w-[140px] rounded-lg border bg-white py-1 shadow-lg">
            <button
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onRename();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
