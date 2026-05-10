// 設定画面: プロフィール / カテゴリ管理 / 固定費管理 / (admin) ホワイトリスト管理
//
// 設計書: docs/design.md §5

import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/lib/expense/categories-server";
import { ProfileSection } from "@/components/settings/profile-section";
import { CategorySection } from "@/components/settings/category-section";
import { RecurringSection } from "@/components/settings/recurring-section";
import { AllowedUsersSection } from "@/components/settings/allowed-users-section";
import { SignOutSection } from "@/components/settings/sign-out-section";
import type {
  AllowedUser,
  RecurringExpense,
  UserProfile,
} from "@/types/database";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // (app)/layout.tsx で認証チェック済みのため user は必ず存在するが、
  // null safety のため type narrow
  if (!user) return null;

  const userEmail = (user.email ?? "").toLowerCase();

  // プロフィール / カテゴリ / 固定費 / ロール / (admin の場合) ホワイトリスト全件 を並列取得
  const [profileRes, categories, recurringRes, allowedSelfRes, allowedAllRes] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("display_name, birth_year")
        .eq("user_id", user.id)
        .maybeSingle(),
      listCategories(supabase),
      supabase
        .from("recurring_expenses")
        .select("*")
        .order("active", { ascending: false })
        .order("day_of_month", { ascending: true }),
      // 自分のロール取得（is_admin 判定）
      supabase
        .from("allowed_users")
        .select("role")
        .eq("email", userEmail)
        .maybeSingle(),
      // admin 専用: 全ホワイトリスト取得（admin でなければ RLS で空）
      supabase
        .from("allowed_users")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);

  const profile = (profileRes.data as Pick<UserProfile, "display_name" | "birth_year"> | null) ?? null;
  const recurring = (recurringRes.data ?? []) as RecurringExpense[];
  const isAdmin = allowedSelfRes.data?.role === "admin";
  const allowedUsers = isAdmin ? ((allowedAllRes.data ?? []) as AllowedUser[]) : [];

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          プロフィール / カテゴリ / 固定費{isAdmin ? " / 管理" : ""}
        </p>
      </header>

      <ProfileSection initial={profile} />

      <CategorySection categories={categories} currentUserId={user.id} />

      <RecurringSection recurring={recurring} categories={categories} />

      {isAdmin && (
        <AllowedUsersSection users={allowedUsers} currentUserEmail={userEmail} />
      )}

      <SignOutSection />
    </div>
  );
}
