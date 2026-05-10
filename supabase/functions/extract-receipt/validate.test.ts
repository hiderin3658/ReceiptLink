import { describe, expect, it } from "vitest";
import { OcrValidationError, validateOcrResult } from "./validate";

/** validate.ts 内の todayInJst と同じロジックでテストの期待値を生成 */
function jstToday(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

const validBase = {
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
  ],
  discounts: [],
  confidence: 0.92,
  store_category_hint: "supermarket",
};

describe("validateOcrResult", () => {
  it("正常な入力をそのまま返す", () => {
    const out = validateOcrResult(validBase);
    expect(out.store_name).toBe("ライフ");
    expect(out.purchased_at).toBe("2026-04-27");
    expect(out.total_amount).toBe(1623);
    expect(out.items).toHaveLength(1);
    expect(out.items[0]!.raw_name).toBe("玉ねぎ");
    expect(out.items[0]!.category_hint).toBe("食費");
    // tax_rate 未指定なので 10 にフォールバック
    expect(out.items[0]!.tax_rate).toBe(10);
    expect(out.discounts).toEqual([]);
    expect(out.confidence).toBeCloseTo(0.92, 2);
    expect(out.store_category_hint).toBe("supermarket");
  });

  it("非オブジェクトは throw", () => {
    expect(() => validateOcrResult(null)).toThrow(OcrValidationError);
    expect(() => validateOcrResult("string")).toThrow(OcrValidationError);
    expect(() => validateOcrResult(42)).toThrow(OcrValidationError);
  });

  it("items が空配列なら throw", () => {
    expect(() => validateOcrResult({ ...validBase, items: [] })).toThrow(
      /non-empty/i,
    );
  });

  it("items が未定義なら throw", () => {
    const { items: _items, ...rest } = validBase;
    void _items;
    expect(() => validateOcrResult(rest)).toThrow(OcrValidationError);
  });

  it("total_amount が無いと throw", () => {
    const { total_amount: _amount, ...rest } = validBase;
    void _amount;
    expect(() => validateOcrResult(rest)).toThrow(/total_amount/);
  });

  it("total_amount が文字列でも数値化", () => {
    const out = validateOcrResult({ ...validBase, total_amount: "1500" });
    expect(out.total_amount).toBe(1500);
  });

  it("'¥1,500' 表記も整数化（記号除去）", () => {
    const out = validateOcrResult({ ...validBase, total_amount: "¥1,500" });
    expect(out.total_amount).toBe(1500);
  });

  it("ISO 8601 日時（時刻付き）も許容", () => {
    const out = validateOcrResult({
      ...validBase,
      purchased_at: "2026-04-27T18:32:00",
    });
    expect(out.purchased_at).toBe("2026-04-27T18:32:00");
  });

  it("ISO 8601 日時 (タイムゾーン付き) も許容", () => {
    const out = validateOcrResult({
      ...validBase,
      purchased_at: "2026-04-27T18:32:00+09:00",
    });
    expect(out.purchased_at).toBe("2026-04-27T18:32:00+09:00");
  });

  it("purchased_at の形式が不正なら今日（JST）の日付を fallback", () => {
    const todayJst = jstToday();
    const out = validateOcrResult({ ...validBase, purchased_at: "2026/04/27" });
    expect(out.purchased_at).toBe(todayJst);
  });

  it("purchased_at が無い場合も今日（JST）の日付を fallback", () => {
    const todayJst = jstToday();
    const { purchased_at: _purchased, ...rest } = validBase;
    void _purchased;
    const out = validateOcrResult(rest);
    expect(out.purchased_at).toBe(todayJst);
  });

  it("category_hint が標準名と一致しなければ null", () => {
    const out = validateOcrResult({
      ...validBase,
      items: [{ ...validBase.items[0]!, category_hint: "imaginary" }],
    });
    expect(out.items[0]!.category_hint).toBeNull();
  });

  it("tax_rate=8 が指定されたらそのまま採用", () => {
    const out = validateOcrResult({
      ...validBase,
      items: [{ ...validBase.items[0]!, tax_rate: 8 }],
    });
    expect(out.items[0]!.tax_rate).toBe(8);
  });

  it("tax_rate=10 が指定されたらそのまま採用", () => {
    const out = validateOcrResult({
      ...validBase,
      items: [{ ...validBase.items[0]!, tax_rate: 10 }],
    });
    expect(out.items[0]!.tax_rate).toBe(10);
  });

  it("tax_rate が文字列 '8' でも 8 として採用", () => {
    const out = validateOcrResult({
      ...validBase,
      items: [{ ...validBase.items[0]!, tax_rate: "8" }],
    });
    expect(out.items[0]!.tax_rate).toBe(8);
  });

  it("tax_rate が想定外 (0 / 5 / 12 / null / 文字列) なら 10 にフォールバック", () => {
    for (const value of [0, 5, 12, null, "abc", undefined]) {
      const out = validateOcrResult({
        ...validBase,
        items: [{ ...validBase.items[0]!, tax_rate: value }],
      });
      expect(out.items[0]!.tax_rate).toBe(10);
    }
  });

  it("category_hint 未指定は null", () => {
    const item = { ...validBase.items[0] } as Record<string, unknown>;
    delete item.category_hint;
    const out = validateOcrResult({ ...validBase, items: [item] });
    expect(out.items[0]!.category_hint).toBeNull();
  });

  it("item.raw_name が空なら throw", () => {
    expect(() =>
      validateOcrResult({
        ...validBase,
        items: [{ ...validBase.items[0]!, raw_name: "" }],
      }),
    ).toThrow(/raw_name/);
  });

  it("item.total_price が無いと throw", () => {
    const item = { ...validBase.items[0] } as Record<string, unknown>;
    delete item.total_price;
    expect(() => validateOcrResult({ ...validBase, items: [item] })).toThrow(
      /total_price/,
    );
  });

  it("quantity に文字列・null が混じっても許容", () => {
    const out = validateOcrResult({
      ...validBase,
      items: [
        { ...validBase.items[0]!, quantity: "2.5" },
        { ...validBase.items[0]!, raw_name: "豆腐", quantity: null, total_price: 80 },
        { ...validBase.items[0]!, raw_name: "ねぎ", quantity: undefined, total_price: 100 },
      ],
    });
    expect(out.items[0]!.quantity).toBe(2.5);
    expect(out.items[1]!.quantity).toBeNull();
    expect(out.items[2]!.quantity).toBeNull();
  });

  it("discounts は形式を整え、不正要素は除く", () => {
    const out = validateOcrResult({
      ...validBase,
      discounts: [
        { label: "クーポン", amount: -60 },
        { label: "セール", amount: "abc" }, // 数値化失敗 → 除外
        "string", // オブジェクトではない → 除外
        { amount: -100 }, // label 無し → "discount" にフォールバック
      ],
    });
    expect(out.discounts).toEqual([
      { label: "クーポン", amount: -60 },
      { label: "discount", amount: -100 },
    ]);
  });

  it("discounts が undefined / null でも空配列で返す", () => {
    const out = validateOcrResult({ ...validBase, discounts: undefined });
    expect(out.discounts).toEqual([]);
    const out2 = validateOcrResult({ ...validBase, discounts: null });
    expect(out2.discounts).toEqual([]);
  });

  it("confidence は 0..1 にクランプ", () => {
    expect(validateOcrResult({ ...validBase, confidence: 1.5 }).confidence).toBe(1);
    expect(validateOcrResult({ ...validBase, confidence: -0.1 }).confidence).toBe(0);
  });

  it("confidence が無ければ 0.5 を fallback", () => {
    const { confidence: _conf, ...rest } = validBase;
    void _conf;
    expect(validateOcrResult(rest).confidence).toBe(0.5);
  });

  it("store_name は trim、空なら null", () => {
    const out = validateOcrResult({ ...validBase, store_name: "   " });
    expect(out.store_name).toBeNull();
    const out2 = validateOcrResult({ ...validBase, store_name: "  ライフ  " });
    expect(out2.store_name).toBe("ライフ");
  });

  it("store_category_hint が標準値と一致しなければ null", () => {
    const out = validateOcrResult({
      ...validBase,
      store_category_hint: "imaginary",
    });
    expect(out.store_category_hint).toBeNull();
  });

  it("store_category_hint 未指定は null", () => {
    const { store_category_hint: _h, ...rest } = validBase;
    void _h;
    const out = validateOcrResult(rest);
    expect(out.store_category_hint).toBeNull();
  });
});
