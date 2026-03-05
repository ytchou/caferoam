import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Sanitize a returnTo query param to prevent open-redirect attacks.
 *  Accepts only same-origin relative paths (starts with /, not //).
 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const rtf = new Intl.RelativeTimeFormat('zh-TW', { numeric: 'auto' });

/** Format a date as a relative string (e.g. "3 週前", "昨天"). */
export function formatRelativeTime(isoString: string): string {
  const diffMs = new Date(isoString).getTime() - Date.now();
  const diffSec = Math.round(diffMs / 1000);
  const diffMin = Math.round(diffSec / 60);
  const diffHour = Math.round(diffMin / 60);
  const diffDay = Math.round(diffHour / 24);
  const diffWeek = Math.round(diffDay / 7);
  const diffMonth = Math.round(diffDay / 30);

  if (Math.abs(diffSec) < 60) return rtf.format(diffSec, 'second');
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  if (Math.abs(diffHour) < 24) return rtf.format(diffHour, 'hour');
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, 'day');
  if (Math.abs(diffWeek) < 5) return rtf.format(diffWeek, 'week');
  return rtf.format(diffMonth, 'month');
}
