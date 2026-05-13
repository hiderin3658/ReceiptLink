// extract-receipt Edge Function の出力 (OcrResult) を、ExpenseForm が
// プリフィルできる ExpenseRecordInput に変換する。
//
// 純粋関数。クライアントコンポーネント・テストの両方で利用する。
// 設計書: docs/design.md §6

import type { ExpenseCategory, ExpenseSource } from "@/types/database";
import { mapCategoryHintToId } from "./categories";
import { normalizePurchasedAt } from "./date-utils";
import type { ExpenseItemInput, ExpenseRecordInput } from "./schema";

/** extract-receipt のレスポンス形（Edge Function 側 types.ts と整合させる） */
export interface OcrItem {
  raw_name: string;
  quantity: number | null;
  unit: string | null;
  total_price: number;
  /** Gemini が推定したカテゴリ名（標準カテゴリ名と一致しなければフォールバック） */
  category_hint: string | null;
}

export interface OcrResult {
  store_name: string | null;
  /** ISO 8601。日付のみ（YYYY-MM-DD）または日時を許容 */
  purchased_at: string;
  total_amount: number;
  items: OcrItem[];
  discounts: { label: string; amount: number }[];
  confidence: number;
  /** Gemini が推定した店舗カテゴリ（参考情報、フォーム反映はしない） */
  store_category_hint?: string | null;
}

/** OcrResult → ExpenseRecordInput
 *
 *  - source_type は "receipt" 固定
 *  - image_paths は呼出側で 1 件以上を渡してくる前提
 *  - category_hint は categories 配列と照合して category_id にマップ
 *    （マッチしなければ「その他」にフォールバック）
 *  - discounts の扱い:
 *    - 各 item.discount = 0 で初期化（プロラタ配賦は不確かなため避ける）
 *    - レシート全体の値引きは note フィールドに転記
 *    - total_amount は OCR が返した「値引き後合計」をそのまま採用
 *    - ユーザーは編集画面で個別に discount を調整可能
 */
export function ocrToExpenseInput(
  ocr: OcrResult,
  imagePaths: string[],
  categories: ExpenseCategory[],
): ExpenseRecordInput {
  const items: ExpenseItemInput[] = ocr.items.map((it) => ({
    raw_name: it.raw_name,
    display_name: "",
    category_id: mapCategoryHintToId(categories, it.category_hint),
    // OCR が返した数量・単位は UI に出さない方針のためフォームには反映しない
    // （Gemini プロンプトは現状維持。返ってきた値を破棄するだけ）
    quantity: null,
    unit: "",
    unit_price: null,
    total_price: Math.max(0, Math.round(it.total_price)),
    discount: 0,
  }));

  // total_amount は OCR 値そのまま採用。値引きがある場合は OCR 側で
  // discount された後の合計が来ている前提（Gemini プロンプトの指示通り）
  const total_amount = Math.max(0, Math.round(ocr.total_amount));

  return {
    // OCR の purchased_at は時刻付き ISO 8601 / スラッシュ区切り / 和暦等
    // 様々なフォーマットで返ってくる可能性があるため、<input type="date"> が
    // 受け付ける YYYY-MM-DD に正規化する。詳細は date-utils.ts を参照。
    purchased_at: normalizePurchasedAt(ocr.purchased_at),
    store_name: ocr.store_name ?? "",
    total_amount,
    note:
      ocr.discounts.length > 0
        ? `値引き: ${ocr.discounts
            .map((d) => `${d.label} ${d.amount.toLocaleString()}`)
            .join(", ")}`
        : "",
    source_type: "receipt" satisfies ExpenseSource,
    image_paths: imagePaths,
    items,
  };
}

/** UUID v4 生成（crypto.randomUUID が使える場合は使う） */
export function generateImageFileName(originalName: string): string {
  const ext = (() => {
    const dot = originalName.lastIndexOf(".");
    if (dot < 0) return "jpg";
    const e = originalName.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(e) ? e : "jpg";
  })();
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${uuid}.${ext}`;
}
