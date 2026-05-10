"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { Home, Receipt, Plus, BarChart3, Settings, HelpCircle } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// ホワイトリスト管理 (admin only) は /settings ページ内で表示する設計のため、
// 専用 /admin ナビは持たない。
//
// typedRoutes 対応: href を Route 型に明示することで、要素ごとに union 型に
// 推論されるのを防ぎ、Link 側の型と整合させる。
const NAV_ITEMS: ReadonlyArray<{ href: Route; label: string; icon: LucideIcon }> = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/expense", label: "履歴", icon: Receipt },
  { href: "/expense/new", label: "追加", icon: Plus },
  { href: "/reports", label: "レポート", icon: BarChart3 },
  { href: "/settings", label: "設定", icon: Settings },
  // ヘルプはサイドナビにも追加 (デスクトップのみ表示)。ボトムナビは 5 項目で
  // 限界のため未追加 → モバイルは設定画面末尾のリンクからアクセスする想定。
  { href: "/help", label: "ヘルプ", icon: HelpCircle },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-[var(--color-border)] md:block">
      <div className="sticky top-0 p-4">
        <Link href="/dashboard" className="mb-6 block text-lg font-bold">
          ReceiptLink
        </Link>
        <nav aria-label="メインナビゲーション">
          <ul className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                        : "text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted)]",
                    )}
                  >
                    <Icon size={18} aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
