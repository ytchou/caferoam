'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Toaster } from 'sonner';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/shops', label: 'Shops' },
  { href: '/admin/jobs', label: 'Jobs' },
  { href: '/admin/taxonomy', label: 'Taxonomy' },
];

const SEGMENT_LABELS: Record<string, string> = {
  admin: 'Admin',
  shops: 'Shops',
  jobs: 'Jobs',
  taxonomy: 'Taxonomy',
};

function useBreadcrumbs(pathname: string) {
  const segments = pathname.split('/').filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let href = '';
  for (const seg of segments) {
    href += `/${seg}`;
    crumbs.push({ label: SEGMENT_LABELS[seg] ?? seg, href });
  }
  return crumbs;
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const crumbs = useBreadcrumbs(pathname);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        setUserEmail(session?.user.email ?? null);
      });
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b bg-white px-6 py-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1 text-sm"
        >
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <span className="text-gray-300">/</span>}
              {i < crumbs.length - 1 ? (
                <Link
                  href={crumb.href}
                  className="text-gray-500 hover:text-gray-900"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
        {userEmail && (
          <span className="text-sm text-gray-500">{userEmail}</span>
        )}
      </header>

      <div className="flex flex-1">
        <aside className="w-56 border-r bg-gray-50 p-4">
          <h2 className="mb-6 text-lg font-bold">Admin</h2>
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? pathname === '/admin'
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-md px-3 py-2 text-sm ${
                    isActive
                      ? 'bg-gray-200 font-medium text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 p-6">{children}</main>
      </div>

      <Toaster position="bottom-right" />
    </div>
  );
}
