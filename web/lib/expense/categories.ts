// expense_categories の純粋関数ユーティリティ。
//
// クライアント・サーバー両方から利用可能。
// DB アクセス（listCategories）は categories-server.ts に分離。

import type { ExpenseCategory } from "@/types/database";

/** 既定カテゴリ名「その他」。標準カテゴリ シードと一致させること。 */
export const FALLBACK_CATEGORY_NAME = "その他";

/** 「その他」カテゴリの id を返す。フォーム初期値や OCR 失敗時のフォールバックに使う。
 *  標準カテゴリは必ず存在する前提だが、念のため見つからなければ最初のカテゴリを返す。 */
export function pickFallbackCategoryId(categories: ExpenseCategory[]): string {
  const fallback = categories.find(
    (c) => c.user_id === null && c.name === FALLBACK_CATEGORY_NAME,
  );
  if (fallback) return fallback.id;
  return categories[0]?.id ?? "";
}

/** OCR の category_hint（カテゴリ名）から expense_categories.id へマップ。
 *  完全一致しなければ「その他」にフォールバックする純粋関数。 */
export function mapCategoryHintToId(
  categories: ExpenseCategory[],
  hint: string | null | undefined,
): string {
  if (hint) {
    const matched = categories.find((c) => c.name === hint);
    if (matched) return matched.id;
  }
  return pickFallbackCategoryId(categories);
}
