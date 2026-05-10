// Gemini が返した OCR 結果（JSON 文字列をパース後）を OcrResult として検証する。
//
// LLM の出力は JSON Schema で固定しても乱れることがあるため、必須項目の存在と
// 型を厳密にチェックして安全に整形する。純粋関数として実装し vitest で検証。

import { STANDARD_CATEGORY_NAMES, STORE_CATEGORY_HINTS } from "../_shared/prompts.ts";
import type { OcrItem, OcrResult } from "../_shared/types.ts";

const VALID_CATEGORY_HINTS = new Set<string>(STANDARD_CATEGORY_NAMES);
const VALID_STORE_HINTS = new Set<string>(STORE_CATEGORY_HINTS);

/** 検証エラーを表す。呼び出し側で catch して fallback / log する */
export class OcrValidationError extends Error {
  constructor(message: string, public readonly path?: string) {
    super(message);
    this.name = "OcrValidationError";
  }
}

/** ISO 8601 日付（YYYY-MM-DD）または日時（YYYY-MM-DDTHH:mm[:ss]）の緩いバリデート */
function isIsoDateLike(s: unknown): s is string {
  return (
    typeof s === "string" &&
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(s)
  );
}

/** 今日の日付を JST (Asia/Tokyo) で返す。purchased_at の fallback 用。 */
function todayInJst(): string {
  const now = new Date();
  const jstShifted = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jstShifted.toISOString().slice(0, 10);
}

/** 整数化（小数を四捨五入）。NaN や非数値は null */
function toInt(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v) : null;
  if (typeof v === "string") {
    // "¥1,500" 等の通貨記号・カンマを取り除いてから Number 化
    const stripped = v.replace(/[^\d.\-]/g, "");
    if (stripped === "" || stripped === "-" || stripped === ".") return null;
    const n = Number(stripped);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}

/** 数量（小数 OK、null 許容） */
function toNum(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown, fallback: string | null = null): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  return fallback;
}

/** items[] の各要素を検証して OcrItem に整える。検証失敗時は throw */
function validateItem(raw: unknown, idx: number): OcrItem {
  if (typeof raw !== "object" || raw === null) {
    throw new OcrValidationError(
      `items[${idx}] is not an object`,
      `items[${idx}]`,
    );
  }
  const r = raw as Record<string, unknown>;

  const raw_name = asString(r.raw_name);
  if (!raw_name) {
    throw new OcrValidationError(
      `items[${idx}].raw_name is required`,
      `items[${idx}].raw_name`,
    );
  }

  const total_price_int = toInt(r.total_price);
  if (total_price_int === null) {
    throw new OcrValidationError(
      `items[${idx}].total_price must be a number`,
      `items[${idx}].total_price`,
    );
  }

  // tax_rate は 8 or 10。範囲外/不正値は 10 (標準税率) にフォールバック。
  // インボイス制度未対応レシートやマーク不鮮明な場合の安全側挙動。
  const tax_rate: 8 | 10 = toInt(r.tax_rate) === 8 ? 8 : 10;

  // category_hint は標準カテゴリ名と厳密に一致するか、null
  const hintRaw = typeof r.category_hint === "string" ? r.category_hint.trim() : null;
  const category_hint = hintRaw && VALID_CATEGORY_HINTS.has(hintRaw) ? hintRaw : null;

  return {
    raw_name,
    quantity: toNum(r.quantity),
    unit: asString(r.unit),
    total_price: total_price_int,
    tax_rate,
    category_hint,
  };
}

/** discounts[] の検証 */
function validateDiscounts(
  raw: unknown,
): { label: string; amount: number }[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [];
  const out: { label: string; amount: number }[] = [];
  for (const d of raw) {
    if (typeof d !== "object" || d === null) continue;
    const o = d as Record<string, unknown>;
    const label = asString(o.label, "discount") ?? "discount";
    const amount = toInt(o.amount);
    if (amount === null) continue;
    out.push({ label, amount });
  }
  return out;
}

/** Gemini が返した JSON を OcrResult に検証・整形する。
 *  必須: items, total_amount, purchased_at（不足時は throw）
 *  任意: store_name, discounts, confidence, store_category_hint */
export function validateOcrResult(raw: unknown): OcrResult {
  if (typeof raw !== "object" || raw === null) {
    throw new OcrValidationError("Response is not an object");
  }
  const r = raw as Record<string, unknown>;

  const purchased_at = isIsoDateLike(r.purchased_at)
    ? (r.purchased_at as string)
    : todayInJst();

  const total_amount = toInt(r.total_amount);
  if (total_amount === null) {
    throw new OcrValidationError("total_amount must be a number", "total_amount");
  }

  if (!Array.isArray(r.items) || r.items.length === 0) {
    throw new OcrValidationError("items must be a non-empty array", "items");
  }

  const items = r.items.map((it, i) => validateItem(it, i));
  const discounts = validateDiscounts(r.discounts);

  let confidence = toNum(r.confidence);
  if (confidence === null) confidence = 0.5;
  confidence = Math.max(0, Math.min(1, confidence));

  const storeHintRaw =
    typeof r.store_category_hint === "string" ? r.store_category_hint.trim() : null;
  const store_category_hint =
    storeHintRaw && VALID_STORE_HINTS.has(storeHintRaw) ? storeHintRaw : null;

  return {
    store_name: asString(r.store_name),
    purchased_at,
    total_amount,
    items,
    discounts,
    confidence,
    store_category_hint,
  };
}
