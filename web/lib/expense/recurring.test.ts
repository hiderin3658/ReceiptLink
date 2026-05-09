import { describe, expect, it } from "vitest";
import { pendingMonths, resolveDayOfMonth } from "./recurring";
import type { RecurringExpense } from "@/types/database";

describe("resolveDayOfMonth", () => {
  it("月内に存在する日はそのまま返す", () => {
    expect(resolveDayOfMonth(2026, 5, 15)).toBe(15);
    expect(resolveDayOfMonth(2026, 5, 31)).toBe(31);
  });

  it("当月に存在しない日は月末日に丸める（4 月の 31 日 → 30 日）", () => {
    expect(resolveDayOfMonth(2026, 4, 31)).toBe(30);
  });

  it("2 月の 31 日 → 28 日（平年）", () => {
    expect(resolveDayOfMonth(2026, 2, 31)).toBe(28);
  });

  it("2 月の 31 日 → 29 日（うるう年）", () => {
    expect(resolveDayOfMonth(2024, 2, 31)).toBe(29);
  });

  it("月始の日もそのまま", () => {
    expect(resolveDayOfMonth(2026, 6, 1)).toBe(1);
  });
});

const baseRec: RecurringExpense = {
  id: "rec-1",
  user_id: "u1",
  name: "家賃",
  category_id: "cat-1",
  amount: 80000,
  day_of_month: 1,
  active: true,
  last_generated_month: null,
  note: null,
  created_at: "2026-01-15T00:00:00Z",
  updated_at: "2026-01-15T00:00:00Z",
};

describe("pendingMonths", () => {
  it("active=false なら常に空", () => {
    const today = new Date(2026, 5, 1);
    const out = pendingMonths({ ...baseRec, active: false }, today);
    expect(out).toEqual([]);
  });

  it("初回生成: created_at の翌月から当月まで列挙", () => {
    // created_at = 2026-01-15、当月 = 2026-04
    const today = new Date(2026, 3, 5); // 2026-04-05
    const out = pendingMonths(baseRec, today);
    expect(out).toEqual(["2026-02-01", "2026-03-01", "2026-04-01"]);
  });

  it("last_generated_month の翌月から当月まで列挙", () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const out = pendingMonths(
      { ...baseRec, last_generated_month: "2026-03-01" },
      today,
    );
    expect(out).toEqual(["2026-04-01", "2026-05-01"]);
  });

  it("last_generated_month が当月以降なら空", () => {
    const today = new Date(2026, 4, 10); // 2026-05-10
    const out = pendingMonths(
      { ...baseRec, last_generated_month: "2026-05-01" },
      today,
    );
    expect(out).toEqual([]);
  });

  it("年をまたぐ列挙", () => {
    const today = new Date(2026, 1, 10); // 2026-02-10
    const out = pendingMonths(
      { ...baseRec, last_generated_month: "2025-11-01" },
      today,
    );
    expect(out).toEqual(["2025-12-01", "2026-01-01", "2026-02-01"]);
  });

  it("12 月 → 1 月の繰り上がり (last_generated_month=12月)", () => {
    const today = new Date(2026, 0, 5); // 2026-01-05
    const out = pendingMonths(
      { ...baseRec, last_generated_month: "2025-12-01" },
      today,
    );
    expect(out).toEqual(["2026-01-01"]);
  });

  it("初回 created_at が 12 月でも翌年 1 月から開始", () => {
    const today = new Date(2026, 1, 10); // 2026-02-10
    const out = pendingMonths(
      { ...baseRec, created_at: "2025-12-15T00:00:00Z" },
      today,
    );
    expect(out).toEqual(["2026-01-01", "2026-02-01"]);
  });
});
