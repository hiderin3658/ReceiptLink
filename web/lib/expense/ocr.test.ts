import { describe, expect, it } from "vitest";
import {
  generateImageFileName,
  ocrToExpenseInput,
  type OcrResult,
} from "./ocr";
import type { ExpenseCategory } from "@/types/database";

const CAT_FOOD = "11111111-1111-4111-8111-111111111111";
const CAT_DAILY = "22222222-2222-4222-8222-222222222222";
const CAT_OTHER = "99999999-9999-4999-8999-999999999999";

const sampleCategories: ExpenseCategory[] = [
  { id: CAT_FOOD, user_id: null, name: "食費", sort_order: 10, is_default: true, created_at: "2026-04-01T00:00:00Z" },
  { id: CAT_DAILY, user_id: null, name: "日用品", sort_order: 20, is_default: true, created_at: "2026-04-01T00:00:00Z" },
  { id: CAT_OTHER, user_id: null, name: "その他", sort_order: 99, is_default: true, created_at: "2026-04-01T00:00:00Z" },
];

const sampleOcr: OcrResult = {
  store_name: "ライフ",
  purchased_at: "2026-04-27",
  total_amount: 1623,
  items: [
    {
      raw_name: "玉ねぎ",
      quantity: 1,
      unit: "袋",
      total_price: 198,
      category_hint: "食費",
    },
    {
      raw_name: "シャンプー",
      quantity: 1,
      unit: "個",
      total_price: 698,
      category_hint: "日用品",
    },
  ],
  discounts: [{ label: "クーポン", amount: -60 }],
  confidence: 0.92,
  store_category_hint: "supermarket",
};

describe("ocrToExpenseInput", () => {
  it("基本変換で source_type=receipt、image_paths が反映される", () => {
    const out = ocrToExpenseInput(sampleOcr, ["uid/abc.jpg"], sampleCategories);
    expect(out.source_type).toBe("receipt");
    expect(out.image_paths).toEqual(["uid/abc.jpg"]);
    expect(out.purchased_at).toBe("2026-04-27");
    expect(out.store_name).toBe("ライフ");
    expect(out.total_amount).toBe(1623);
    expect(out.items).toHaveLength(2);
  });

  it("items は OCR 順を保持し、カテゴリヒントを id にマップ", () => {
    const out = ocrToExpenseInput(sampleOcr, [], sampleCategories);
    expect(out.items[0]!.raw_name).toBe("玉ねぎ");
    expect(out.items[0]!.category_id).toBe(CAT_FOOD);
    expect(out.items[1]!.raw_name).toBe("シャンプー");
    expect(out.items[1]!.category_id).toBe(CAT_DAILY);
  });

  it("category_hint が標準名と一致しない場合は「その他」に丸める", () => {
    const out = ocrToExpenseInput(
      {
        ...sampleOcr,
        items: [{ ...sampleOcr.items[0]!, category_hint: "imaginary-category" }],
      },
      [],
      sampleCategories,
    );
    expect(out.items[0]!.category_id).toBe(CAT_OTHER);
  });

  it("category_hint が null でも「その他」にフォールバック", () => {
    const out = ocrToExpenseInput(
      {
        ...sampleOcr,
        items: [{ ...sampleOcr.items[0]!, category_hint: null }],
      },
      [],
      sampleCategories,
    );
    expect(out.items[0]!.category_id).toBe(CAT_OTHER);
  });

  it("店舗名が null の場合は空文字列に置き換え（フォーム入力欄の慣習）", () => {
    const out = ocrToExpenseInput({ ...sampleOcr, store_name: null }, [], sampleCategories);
    expect(out.store_name).toBe("");
  });

  it("負の total_price は 0 に丸める", () => {
    const out = ocrToExpenseInput(
      {
        ...sampleOcr,
        items: [{ ...sampleOcr.items[0]!, total_price: -100 }],
      },
      [],
      sampleCategories,
    );
    expect(out.items[0]!.total_price).toBe(0);
  });

  it("小数の total_price は四捨五入", () => {
    const out = ocrToExpenseInput(
      {
        ...sampleOcr,
        items: [{ ...sampleOcr.items[0]!, total_price: 198.6 }],
      },
      [],
      sampleCategories,
    );
    expect(out.items[0]!.total_price).toBe(199);
  });

  it("discounts がある場合は note に転記", () => {
    const out = ocrToExpenseInput(sampleOcr, [], sampleCategories);
    expect(out.note).toContain("クーポン");
    expect(out.note).toContain("-60");
  });

  it("discounts が空なら note は空", () => {
    const out = ocrToExpenseInput({ ...sampleOcr, discounts: [] }, [], sampleCategories);
    expect(out.note).toBe("");
  });

  it("image_paths は複数渡しを想定", () => {
    const out = ocrToExpenseInput(sampleOcr, ["a.jpg", "b.jpg"], sampleCategories);
    expect(out.image_paths).toEqual(["a.jpg", "b.jpg"]);
  });
});

describe("generateImageFileName", () => {
  it("拡張子を正規化して保持", () => {
    expect(generateImageFileName("photo.JPG")).toMatch(/\.jpg$/);
    expect(generateImageFileName("snap.png")).toMatch(/\.png$/);
    expect(generateImageFileName("scan.WEBP")).toMatch(/\.webp$/);
  });

  it("拡張子無しは jpg を fallback", () => {
    expect(generateImageFileName("noext")).toMatch(/\.jpg$/);
  });

  it("怪しい拡張子（記号・長すぎ）は jpg に丸める", () => {
    expect(generateImageFileName("file.../weird")).toMatch(/\.jpg$/);
    expect(generateImageFileName("file.toolongextension")).toMatch(/\.jpg$/);
  });

  it("複数回呼んでも一意（衝突しない）", () => {
    const a = generateImageFileName("a.jpg");
    const b = generateImageFileName("a.jpg");
    expect(a).not.toBe(b);
  });
});
