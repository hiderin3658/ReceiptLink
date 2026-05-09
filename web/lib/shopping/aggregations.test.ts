import { describe, expect, it } from "vitest";
import { aggregateMonthlySummary } from "./aggregations";

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
});

