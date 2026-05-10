import { describe, expect, it } from "vitest";
import {
  aggregateMonthlySummary,
  categoryBreakdown,
  monthlyHistory,
  monthlyTotal,
  monthOverMonthRatio,
  paceForMonth,
  type ItemForAggregation,
} from "./aggregations";

describe("aggregateMonthlySummary", () => {
  it("空配列は空配列", () => {
    expect(aggregateMonthlySummary([])).toEqual([]);
  });

  it("同じ月のレコードを合算", () => {
    const out = aggregateMonthlySummary([
      { purchased_at: "2026-04-10", total_amount: 1000 },
      { purchased_at: "2026-04-15", total_amount: 2500 },
      { purchased_at: "2026-04-27", total_amount: 800 },
    ]);
    expect(out).toEqual([
      { year_month: "2026-04", total: 4300, record_count: 3 },
    ]);
  });

  it("複数月をまたぎ、新しい順に並べる", () => {
    const out = aggregateMonthlySummary([
      { purchased_at: "2026-02-05", total_amount: 1000 },
      { purchased_at: "2026-04-10", total_amount: 2000 },
      { purchased_at: "2026-03-15", total_amount: 1500 },
      { purchased_at: "2026-04-20", total_amount: 3000 },
    ]);
    expect(out).toEqual([
      { year_month: "2026-04", total: 5000, record_count: 2 },
      { year_month: "2026-03", total: 1500, record_count: 1 },
      { year_month: "2026-02", total: 1000, record_count: 1 },
    ]);
  });

  it("年をまたぐ並び替え", () => {
    const out = aggregateMonthlySummary([
      { purchased_at: "2025-12-31", total_amount: 100 },
      { purchased_at: "2026-01-01", total_amount: 200 },
    ]);
    expect(out[0]!.year_month).toBe("2026-01");
    expect(out[1]!.year_month).toBe("2025-12");
  });

  it("ISO 8601 日時 (時刻付き) でも YYYY-MM 切り出しできる", () => {
    const out = aggregateMonthlySummary([
      { purchased_at: "2026-04-10T18:32:00+09:00", total_amount: 1000 },
    ]);
    expect(out[0]!.year_month).toBe("2026-04");
  });
});

describe("monthlyTotal", () => {
  it("該当月の合計のみ抜き出す", () => {
    const rows = [
      { purchased_at: "2026-04-10", total_amount: 1000 },
      { purchased_at: "2026-04-15", total_amount: 500 },
      { purchased_at: "2026-05-01", total_amount: 9999 },
    ];
    expect(monthlyTotal(rows, "2026-04")).toBe(1500);
    expect(monthlyTotal(rows, "2026-05")).toBe(9999);
    expect(monthlyTotal(rows, "2026-06")).toBe(0);
  });
});

describe("monthlyHistory", () => {
  it("過去 N ヶ月（当月含む）を古い順 → 新しい順で返す。データ無い月は 0 で埋める", () => {
    const today = new Date(2026, 4, 15); // 2026-05-15
    const rows = [
      { purchased_at: "2026-03-10", total_amount: 1000 },
      { purchased_at: "2026-05-01", total_amount: 500 },
    ];
    const out = monthlyHistory(rows, today, 4);
    expect(out).toEqual([
      { year_month: "2026-02", total: 0, record_count: 0 },
      { year_month: "2026-03", total: 1000, record_count: 1 },
      { year_month: "2026-04", total: 0, record_count: 0 },
      { year_month: "2026-05", total: 500, record_count: 1 },
    ]);
  });

  it("年をまたいでも正しく月を列挙", () => {
    const today = new Date(2026, 1, 10); // 2026-02-10
    const rows: { purchased_at: string; total_amount: number }[] = [];
    const out = monthlyHistory(rows, today, 3);
    expect(out.map((r) => r.year_month)).toEqual([
      "2025-12",
      "2026-01",
      "2026-02",
    ]);
  });
});

describe("categoryBreakdown", () => {
  const items: ItemForAggregation[] = [
    {
      category_id: "food",
      total_price: 1000,
      discount: 100,
      expense_record_id: "r1",
      purchased_at: "2026-04-10",
    },
    {
      category_id: "food",
      total_price: 500,
      discount: 0,
      expense_record_id: "r1",
      purchased_at: "2026-04-15",
    },
    {
      category_id: "daily",
      total_price: 700,
      discount: 50,
      expense_record_id: "r2",
      purchased_at: "2026-04-20",
    },
    {
      category_id: "food",
      total_price: 9999,
      discount: 0,
      expense_record_id: "r3",
      purchased_at: "2026-05-01", // 別月
    },
  ];

  it("指定月の items のみ集計", () => {
    const out = categoryBreakdown(items, "2026-04");
    expect(out).toHaveLength(2);
    const food = out.find((r) => r.category_id === "food");
    const daily = out.find((r) => r.category_id === "daily");
    expect(food?.total).toBe((1000 - 100) + (500 - 0)); // 1400
    expect(food?.item_count).toBe(2);
    expect(daily?.total).toBe(700 - 50);
    expect(daily?.item_count).toBe(1);
  });

  it("金額の多い順で並べる", () => {
    const out = categoryBreakdown(items, "2026-04");
    expect(out[0]!.category_id).toBe("food"); // 1400
    expect(out[1]!.category_id).toBe("daily"); // 650
  });

  it("該当月にデータが無い場合は空配列", () => {
    const out = categoryBreakdown(items, "2026-06");
    expect(out).toEqual([]);
  });
});

describe("paceForMonth", () => {
  it("月初の経過日数 / 総日数を返す", () => {
    const today = new Date(2026, 4, 1); // 2026-05-01
    const out = paceForMonth(0, today);
    expect(out.actualToDate).toBe(0);
    expect(out.elapsedDays).toBe(1);
    expect(out.daysInMonth).toBe(31);
  });

  it("月の中盤", () => {
    const today = new Date(2026, 4, 15); // 2026-05-15
    const out = paceForMonth(15000, today);
    expect(out.actualToDate).toBe(15000);
    expect(out.elapsedDays).toBe(15);
    expect(out.daysInMonth).toBe(31);
  });

  it("月末日 (4 月 30 日)", () => {
    const today = new Date(2026, 3, 30); // 2026-04-30 (4月は30日)
    const out = paceForMonth(30000, today);
    expect(out.actualToDate).toBe(30000);
    expect(out.elapsedDays).toBe(30);
    expect(out.daysInMonth).toBe(30);
  });
});

describe("monthOverMonthRatio", () => {
  it("増加分を百分率で返す", () => {
    expect(monthOverMonthRatio(1500, 1000)).toBe(50);
  });

  it("減少分は負の値", () => {
    expect(monthOverMonthRatio(800, 1000)).toBe(-20);
  });

  it("前月 0 円なら null", () => {
    expect(monthOverMonthRatio(1000, 0)).toBeNull();
  });

  it("小数点 1 桁で四捨五入", () => {
    expect(monthOverMonthRatio(1037, 1000)).toBe(3.7);
  });
});
