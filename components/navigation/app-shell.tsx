"use client";
import { useRouter } from "next/navigation";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { BottomNav } from "./bottom-nav";
import { HeaderNav } from "./header-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  const isDesktop = useIsDesktop();
  const router = useRouter();

  const handleSearch = (query: string) => {
    router.push(`/map?q=${encodeURIComponent(query)}`);
  };

  return (
    <>
      {isDesktop && <HeaderNav onSearch={handleSearch} />}
      <main className={isDesktop ? "pt-16" : "pb-16"}>{children}</main>
      {!isDesktop && <BottomNav />}
    </>
  );
}
