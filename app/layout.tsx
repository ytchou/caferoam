import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_TC } from 'next/font/google';
import { PostHogProvider } from '@/lib/posthog/provider';
import { SessionTracker } from '@/components/session-tracker';
import { AppShell } from '@/components/navigation/app-shell';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

const notoSansTC = Noto_Sans_TC({
  variable: '--font-noto-sans-tc',
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CafeRoam 啡遊',
  description:
    "Discover Taiwan's best independent coffee shops with AI-powered semantic search.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-TW">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoSansTC.variable} antialiased`}
      >
        <PostHogProvider>
          <SessionTracker />
          <AppShell>{children}</AppShell>
        </PostHogProvider>
      </body>
    </html>
  );
}
