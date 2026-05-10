// Edge Function 共有型定義
//
// 家計簿アプリ ReceiptLink の Edge Function (extract-receipt 等) で
// 共通利用する型を集約する。

/** ai_advice_logs.kind に対応（DB enum と整合させる） */
export type AiKind = "ocr" | "ocr_fallback";

/** Gemini モデル識別子（環境変数で差替可能） */
export type GeminiModel = string;

/** Gemini API 呼出のメタ情報。レスポンスとともに ai_advice_logs に記録される */
export interface GeminiCallMeta {
  model: GeminiModel;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
}

export interface GeminiCallResult<T> {
  data: T;
  meta: GeminiCallMeta;
}

/** Edge Function の標準エラーコード（クライアント側が string-match で分岐できるよう union 化） */
export const EDGE_ERROR_CODES = [
  "AUTH_MISSING_TOKEN",
  "AUTH_INVALID_TOKEN",
  "AUTH_NOT_ALLOWED",
  "AUTH_DB_ERROR",
  "BAD_REQUEST",
  "AI_BLOCKED",
  "AI_TIMEOUT",
  "AI_INVALID_RESPONSE",
  "INTERNAL_ERROR",
] as const;

export type EdgeErrorCode = (typeof EDGE_ERROR_CODES)[number];

/** Edge Function の標準エラーレスポンス */
export interface EdgeError {
  error: string;
  code: EdgeErrorCode;
  detail?: string;
}

/** OCR 結果（extract-receipt 用） */
export interface OcrItem {
  raw_name: string;
  quantity: number | null;
  unit: string | null;
  /** 税込価格（円、整数）。レシートが税抜表示の場合 Gemini が tax_rate で換算した結果。
   *  各品目の合計と OcrResult.total_amount が概ね一致する前提。 */
  total_price: number;
  /** 適用税率（8 = 軽減税率対象 / 10 = 標準税率）。判別不能なら 10 にフォールバック。
   *  ※マークや「軽減」の凡例から Gemini が判定する。 */
  tax_rate: 8 | 10;
  /** Gemini が推定したカテゴリ名（例: "食費" / "日用品"）。クライアント側で
   *  expense_categories.name と完全一致照合し、外れたら「その他」にフォールバック */
  category_hint: string | null;
}

export interface OcrResult {
  store_name: string | null;
  /** ISO 8601 (YYYY-MM-DD or full timestamp) */
  purchased_at: string;
  total_amount: number;
  items: OcrItem[];
  discounts: { label: string; amount: number }[];
  confidence: number;
  /** Gemini が推定した店舗カテゴリ（例: "supermarket" / "drugstore"）。参考情報。 */
  store_category_hint: string | null;
}
