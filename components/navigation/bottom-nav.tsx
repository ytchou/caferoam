"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "首頁", icon: "home" },
  { href: "/map", label: "地圖", icon: "map" },
  { href: "/lists", label: "收藏", icon: "heart" },
  { href: "/profile", label: "我的", icon: "user" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 pb-safe z-40">
      <div className="flex">
        {TABS.map(({ href, label }) => {
          const isActive =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              data-active={isActive}
              className={`flex-1 flex flex-col items-center py-2 gap-0.5 text-xs transition-colors ${
                isActive ? "text-[#E06B3F]" : "text-gray-400"
              }`}
            >
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
