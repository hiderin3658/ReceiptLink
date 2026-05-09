"use server";

// allowed_users CRUD Server Actions（admin only）
//
// 設計書: docs/design.md §3
// RLS: admin のみ INSERT/UPDATE/DELETE 可、自分のみ SELECT、admin は全件 SELECT 可

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "email を入力してください")
  .max(255, "email が長すぎます")
  .email("有効な email を入力してください");

const roleSchema = z.enum(["admin", "user"]);

export type AllowedUserActionState =
  | { ok: true; id?: string }
  | { ok: false; message: string }
  | null;

/** ホワイトリストに email を追加（admin のみ） */
export async function createAllowedUser(
  _prev: AllowedUserActionState,
  input: { email: string; role: "admin" | "user"; note?: string },
): Promise<AllowedUserActionState> {
  const emailParsed = emailSchema.safeParse(input.email);
  if (!emailParsed.success) {
    return { ok: false, message: emailParsed.error.issues[0]?.message ?? "email エラー" };
  }
  const roleParsed = roleSchema.safeParse(input.role);
  if (!roleParsed.success) {
    return { ok: false, message: "ロールが不正です" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("allowed_users")
    .insert({
      email: emailParsed.data,
      role: roleParsed.data,
      note: input.note?.trim() || null,
    })
    .select("id")
    .single();
  if (error || !data) {
    console.error("[allowed_users] create failed:", error?.message);
    if (error?.code === "23505") {
      return { ok: false, message: "この email は既に登録されています" };
    }
    if (error?.code === "42501" || error?.message?.includes("policy")) {
      return { ok: false, message: "管理者権限が必要です" };
    }
    return { ok: false, message: "登録に失敗しました" };
  }

  revalidatePath("/settings");
  return { ok: true, id: data.id };
}

/** ロール変更（admin のみ） */
export async function updateAllowedUserRole(
  id: string,
  role: "admin" | "user",
): Promise<AllowedUserActionState> {
  const roleParsed = roleSchema.safeParse(role);
  if (!roleParsed.success) {
    return { ok: false, message: "ロールが不正です" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("allowed_users")
    .update({ role: roleParsed.data })
    .eq("id", id);
  if (error) {
    console.error("[allowed_users] update failed:", error.message);
    return { ok: false, message: "更新に失敗しました" };
  }

  revalidatePath("/settings");
  return { ok: true };
}

/** ホワイトリストから削除（admin のみ） */
export async function deleteAllowedUser(id: string): Promise<AllowedUserActionState> {
  const supabase = await createClient();
  const { error } = await supabase.from("allowed_users").delete().eq("id", id);
  if (error) {
    console.error("[allowed_users] delete failed:", error.message);
    return { ok: false, message: "削除に失敗しました" };
  }

  revalidatePath("/settings");
  return { ok: true };
}
