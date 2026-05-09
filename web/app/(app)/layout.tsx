import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SideNav } from "@/components/layout/side-nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // DB 側は email を小文字で保存しているため lowercase で比較する
  const { data: allowed } = await supabase
    .from("allowed_users")
    .select("role")
    .eq("email", (user.email ?? "").toLowerCase())
    .maybeSingle();

  if (!allowed) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  // 注: isAdmin は PR-6 の設定画面（カテゴリ管理 / ホワイトリスト管理）で
  //     コンテキスト経由 or props で参照する想定。現状ナビは admin 専用項目を
  //     持たないため、ここでは取得しない。

  return (
    <div className="flex min-h-svh">
      <SideNav />
      <main className="flex-1 pb-20 md:pb-0">
        <div className="mx-auto max-w-2xl px-4 py-6 md:px-6 md:py-8">{children}</div>
      </main>
      <BottomNav />
    </div>
  );
}
