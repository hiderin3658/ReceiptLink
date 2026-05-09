import { describe, expect, it } from "vitest";
import {
  calcTotalAmount,
  expenseItemInputSchema,
  expenseRecordInputSchema,
} from "./schema";

const VALID_UUID = "00000000-0000-4000-8000-000000000001";

describe("expenseItemInputSchema", () => {
  it("最小ケース（品名 + カテゴリ ID）でパース成功", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "豚ロース",
      category_id: VALID_UUID,
    });
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.raw_name).toBe("豚ロース");
      expect(out.data.category_id).toBe(VALID_UUID);
      expect(out.data.total_price).toBe(0);
      expect(out.data.quantity).toBeNull();
    }
  });

  it("品名が空はエラー", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "",
      category_id: VALID_UUID,
    });
    expect(out.success).toBe(false);
    if (!out.success) {
      expect(out.error.format().raw_name?._errors[0]).toContain("必須");
    }
  });

  it("品名 100 文字超はエラー", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "a".repeat(101),
      category_id: VALID_UUID,
    });
    expect(out.success).toBe(false);
  });

  it("category_id が UUID でない場合はエラー", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "x",
      category_id: "not-a-uuid",
    });
    expect(out.success).toBe(false);
    if (!out.success) {
      expect(out.error.format().category_id?._errors[0]).toContain("カテゴリ");
    }
  });

  it("category_id が空文字はエラー", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "x",
      category_id: "",
    });
    expect(out.success).toBe(false);
  });

  it("負の total_price はエラー", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "x",
      category_id: VALID_UUID,
      total_price: -1,
    });
    expect(out.success).toBe(false);
  });

  it("数量・単価の文字列入力は number に変換", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "x",
      category_id: VALID_UUID,
      quantity: "1.5",
      unit_price: "100",
    });
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.quantity).toBe(1.5);
      expect(out.data.unit_price).toBe(100);
    }
  });

  it("空文字列の display_name / unit は null に正規化", () => {
    const out = expenseItemInputSchema.safeParse({
      raw_name: "x",
      category_id: VALID_UUID,
      display_name: "",
      unit: "",
    });
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.display_name).toBeNull();
      expect(out.data.unit).toBeNull();
    }
  });
});

describe("expenseRecordInputSchema", () => {
  const okItems = [{ raw_name: "豚ロース", category_id: VALID_UUID, total_price: 398 }];

  it("正常系: 最小限の入力でパース成功", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      items: okItems,
    });
    expect(out.success).toBe(true);
    if (out.success) {
      expect(out.data.source_type).toBe("manual");
      expect(out.data.items).toHaveLength(1);
      expect(out.data.store_name).toBeNull();
    }
  });

  it("ISO 8601 日時形式（時刻付き）も許容", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27T18:32:00",
      items: okItems,
    });
    expect(out.success).toBe(true);
  });

  it("ISO 8601 日時 (タイムゾーン付き) も許容", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27T18:32:00+09:00",
      items: okItems,
    });
    expect(out.success).toBe(true);
  });

  it("不正な日付フォーマットはエラー", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026/04/27",
      items: okItems,
    });
    expect(out.success).toBe(false);
  });

  it("items が空はエラー", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      items: [],
    });
    expect(out.success).toBe(false);
  });

  it("items が 100 件超はエラー", () => {
    const items = Array.from({ length: 101 }, () => ({
      raw_name: "x",
      category_id: VALID_UUID,
    }));
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      items,
    });
    expect(out.success).toBe(false);
  });

  it("note 500 文字超はエラー", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      note: "a".repeat(501),
      items: okItems,
    });
    expect(out.success).toBe(false);
  });

  it("source_type は manual / receipt / recurring のみ許容", () => {
    const out = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      source_type: "import",
      items: okItems,
    });
    expect(out.success).toBe(false);

    const out2 = expenseRecordInputSchema.safeParse({
      purchased_at: "2026-04-27",
      source_type: "recurring",
      items: okItems,
    });
    expect(out2.success).toBe(true);
  });
});

describe("calcTotalAmount", () => {
  it("空配列は 0", () => {
    expect(calcTotalAmount([])).toBe(0);
  });

  it("total_price の合計から discount を引く", () => {
    expect(
      calcTotalAmount([
        { total_price: 398, discount: 0 },
        { total_price: 198, discount: 30 },
        { total_price: 100, discount: 0 },
      ]),
    ).toBe(398 + 198 - 30 + 100);
  });

  it("値段未入力（0）は加算されない", () => {
    expect(
      calcTotalAmount([
        { total_price: 0, discount: 0 },
        { total_price: 500, discount: 0 },
      ]),
    ).toBe(500);
  });
});
