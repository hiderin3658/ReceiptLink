import { describe, expect, it } from "vitest";
import { mapCategoryHintToId, pickFallbackCategoryId } from "./categories";
import type { ExpenseCategory } from "@/types/database";

const CAT_FOOD = "11111111-1111-4111-8111-111111111111";
const CAT_DAILY = "22222222-2222-4222-8222-222222222222";
const CAT_OTHER = "99999999-9999-4999-8999-999999999999";

const standard: ExpenseCategory[] = [
  { id: CAT_FOOD, user_id: null, name: "食費", sort_order: 10, is_default: true, created_at: "2026-04-01T00:00:00Z" },
  { id: CAT_DAILY, user_id: null, name: "日用品", sort_order: 20, is_default: true, created_at: "2026-04-01T00:00:00Z" },
  { id: CAT_OTHER, user_id: null, name: "その他", sort_order: 99, is_default: true, created_at: "2026-04-01T00:00:00Z" },
];

describe("pickFallbackCategoryId", () => {
  it("「その他」標準カテゴリ id を返す", () => {
    expect(pickFallbackCategoryId(standard)).toBe(CAT_OTHER);
  });

  it("「その他」が無ければ最初のカテゴリ id を返す", () => {
    const noOther = standard.filter((c) => c.name !== "その他");
    expect(pickFallbackCategoryId(noOther)).toBe(CAT_FOOD);
  });

  it("空配列なら空文字を返す", () => {
    expect(pickFallbackCategoryId([])).toBe("");
  });

  it("カスタム「その他」（user_id 付き）はフォールバックに使わない", () => {
    const withCustomOther: ExpenseCategory[] = [
      ...standard.filter((c) => c.name !== "その他"),
      {
        id: "custom-other",
        user_id: "u1",
        name: "その他",
        sort_order: 100,
        is_default: false,
        created_at: "2026-04-01T00:00:00Z",
      },
    ];
    // 標準「その他」が無いので、最初のカテゴリ (CAT_FOOD) にフォールバック
    expect(pickFallbackCategoryId(withCustomOther)).toBe(CAT_FOOD);
  });
});

describe("mapCategoryHintToId", () => {
  it("一致する標準名なら id を返す", () => {
    expect(mapCategoryHintToId(standard, "食費")).toBe(CAT_FOOD);
    expect(mapCategoryHintToId(standard, "日用品")).toBe(CAT_DAILY);
  });

  it("一致しない名前は「その他」にフォールバック", () => {
    expect(mapCategoryHintToId(standard, "imaginary-category")).toBe(CAT_OTHER);
  });

  it("null / undefined / 空文字 もフォールバック", () => {
    expect(mapCategoryHintToId(standard, null)).toBe(CAT_OTHER);
    expect(mapCategoryHintToId(standard, undefined)).toBe(CAT_OTHER);
    expect(mapCategoryHintToId(standard, "")).toBe(CAT_OTHER);
  });

  it("大文字小文字は区別する（OCR 側で完全一致を要求）", () => {
    // "食費" と "ショクヒ" はマッチしない（カタカナ）
    expect(mapCategoryHintToId(standard, "ショクヒ")).toBe(CAT_OTHER);
  });
});
