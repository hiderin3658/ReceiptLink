// 支出登録フォームの Zod スキーマ
//
// クライアント側の即時バリデーションと Server Action での再検証の両方で使う。
// DB スキーマ（supabase/migrations/20260509000001_initial_schema.sql）と
// 整合させること。

import { z } from "zod";

// 0 以上の整数（円・個数等の集計用）。空文字は 0、未入力（undefined）は許容
const nonNegInt = z
  .union([z.number(), z.string()])
  .transform((v) => {
    if (typeof v === "number") return v;
    if (v === "" || v === null || v === undefined) return 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .pipe(z.number().int("整数で入力してください").nonnegative("0 以上で入力してください"));

// 数量（小数 3 桁まで許容）。空文字は null
const quantityField = z
  .union([z.number(), z.string(), z.null()])
  .transform((v) => {
    if (v === null || v === "" || v === undefined) return null;
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  })
  .pipe(z.number().nonnegative("0 以上で入力してください").nullable());

// UUID 形式（expense_categories.id）。空文字は null 扱いせず、必須エラーにする
const requiredUuid = z.string().uuid("カテゴリを選択してください");

export const expenseItemInputSchema = z.object({
  raw_name: z.string().trim().min(1, "品名は必須です").max(100, "品名は 100 文字以内"),
  display_name: z
    .string()
    .trim()
    .max(100, "表示名は 100 文字以内")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  category_id: requiredUuid,
  quantity: quantityField.default(null),
  unit: z
    .string()
    .trim()
    .max(20, "単位は 20 文字以内")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  unit_price: z
    .union([z.number(), z.string(), z.null()])
    .optional()
    .transform((v) => {
      if (v === null || v === "" || v === undefined) return null;
      if (typeof v === "number") return v;
      const n = Number(v);
      return Number.isFinite(n) ? n : NaN;
    })
    .pipe(z.number().int().nonnegative().nullable()),
  total_price: nonNegInt.default(0),
  discount: nonNegInt.default(0),
});

export const expenseRecordInputSchema = z.object({
  // ISO 8601 日付（YYYY-MM-DD）または 日時（YYYY-MM-DDTHH:mm[:ss]）の両方を受け入れる
  purchased_at: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/,
      "日付は YYYY-MM-DD または ISO 8601 日時形式",
    ),
  store_name: z
    .string()
    .trim()
    .max(100, "店舗名は 100 文字以内")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  total_amount: nonNegInt.default(0),
  note: z
    .string()
    .trim()
    .max(500, "メモは 500 文字以内")
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  source_type: z.enum(["receipt", "manual", "recurring"]).default("manual"),
  // Storage 内のレシート画像パス（receipts/<userId>/<uuid>.<ext>）。OCR 由来の場合に保持
  image_paths: z.array(z.string().max(255)).max(5).default([]),
  items: z
    .array(expenseItemInputSchema)
    .min(1, "品目を 1 つ以上追加してください")
    .max(100, "品目は最大 100 件まで"),
});

export type ExpenseItemInput = z.input<typeof expenseItemInputSchema>;
export type ExpenseItemParsed = z.output<typeof expenseItemInputSchema>;
export type ExpenseRecordInput = z.input<typeof expenseRecordInputSchema>;
export type ExpenseRecordParsed = z.output<typeof expenseRecordInputSchema>;

/** items から total_amount を再計算する（クライアント表示・サーバ補正の両方で利用） */
export function calcTotalAmount(items: Pick<ExpenseItemParsed, "total_price" | "discount">[]): number {
  return items.reduce((sum, it) => sum + (it.total_price ?? 0) - (it.discount ?? 0), 0);
}

/** 空の item 行のテンプレート。
 *  display_name と unit はフォーム入力欄が空文字の状態を表すため "" を使う。
 *  category_id は呼出側で「その他」カテゴリの id を埋める想定。
 *  Zod の transform で空文字 → null に正規化される（display_name / unit）。 */
export function makeEmptyItem(defaultCategoryId: string): ExpenseItemInput {
  return {
    raw_name: "",
    display_name: "",
    category_id: defaultCategoryId,
    quantity: null,
    unit: "",
    unit_price: null,
    total_price: 0,
    discount: 0,
  };
}
