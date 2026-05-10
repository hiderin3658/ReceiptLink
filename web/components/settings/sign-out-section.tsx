"use client";

import { LogOut } from "lucide-react";

// アカウントセクション: ログアウトボタン
//
// form action="/api/auth/signout" method="post" でサーバー側 route に POST。
// route 側で supabase.auth.signOut() → /login に 302 リダイレクトする。
// 確認ダイアログだけ JS で挟み、誤クリックを防ぐ。
export function SignOutSection() {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-white p-4">
      <h2 className="mb-2 text-sm font-semibold">アカウント</h2>
      <p className="mb-3 text-xs text-[var(--color-muted-foreground)]">
        現在のセッションを終了します。次回利用時は再度 Google でログインが必要です。
      </p>
      <form
        action="/api/auth/signout"
        method="post"
        onSubmit={(e) => {
          if (!confirm("ログアウトしますか？")) {
            e.preventDefault();
          }
        }}
      >
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-md border border-[var(--color-destructive)] bg-white px-4 py-2 text-sm text-[var(--color-destructive)] hover:bg-[color-mix(in_oklch,var(--color-destructive)_10%,white)]"
        >
          <LogOut size={14} aria-hidden />
          ログアウト
        </button>
      </form>
    </section>
  );
}
