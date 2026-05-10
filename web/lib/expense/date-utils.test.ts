import { describe, expect, it } from "vitest";
import { normalizePurchasedAt } from "./date-utils";

// JST 今日の日付 (テスト実行時点)。fallback ケースの期待値計算用。
function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

describe("normalizePurchasedAt", () => {
  describe("ISO 8601", () => {
    it("YYYY-MM-DD はそのまま", () => {
      expect(normalizePurchasedAt("2026-05-10")).toBe("2026-05-10");
    });
    it("時刻付き ISO 8601 は日付部分のみ", () => {
      expect(normalizePurchasedAt("2026-05-10T00:00:00")).toBe("2026-05-10");
      expect(normalizePurchasedAt("2026-05-10T15:30:00+09:00")).toBe("2026-05-10");
      expect(normalizePurchasedAt("2026-05-10T15:30:00.123Z")).toBe("2026-05-10");
    });
    it("月日が 1 桁でも 0 埋めされる", () => {
      expect(normalizePurchasedAt("2026-5-1")).toBe("2026-05-01");
    });
  });

  describe("区切り文字", () => {
    it("スラッシュ区切り", () => {
      expect(normalizePurchasedAt("2026/05/10")).toBe("2026-05-10");
      expect(normalizePurchasedAt("2026/5/1")).toBe("2026-05-01");
    });
    it("ピリオド区切り", () => {
      expect(normalizePurchasedAt("2026.05.10")).toBe("2026-05-10");
      expect(normalizePurchasedAt("2026.5.10")).toBe("2026-05-10");
    });
  });

  describe("日本語", () => {
    it("YYYY年M月D日", () => {
      expect(normalizePurchasedAt("2026年5月10日")).toBe("2026-05-10");
      expect(normalizePurchasedAt("2026年12月31日")).toBe("2026-12-31");
    });
    it("空白を含む西暦日本語", () => {
      expect(normalizePurchasedAt("2026 年 5 月 10 日")).toBe("2026-05-10");
    });
    it("末尾の 日 が無くても認識する", () => {
      expect(normalizePurchasedAt("2026年5月10")).toBe("2026-05-10");
    });
  });

  describe("和暦", () => {
    it("令和X年M月D日 (令和8年=2026年)", () => {
      expect(normalizePurchasedAt("令和8年5月10日")).toBe("2026-05-10");
    });
    it("令和元年=2019年", () => {
      expect(normalizePurchasedAt("令和元年5月10日")).toBe("2019-05-10");
    });
    it("R8/5/10 短縮表記", () => {
      expect(normalizePurchasedAt("R8/5/10")).toBe("2026-05-10");
    });
    it("R8.5.10 ピリオド", () => {
      expect(normalizePurchasedAt("R8.5.10")).toBe("2026-05-10");
    });
    it("平成31年=2019年", () => {
      expect(normalizePurchasedAt("平成31年5月10日")).toBe("2019-05-10");
    });
    it("H31/5/10", () => {
      expect(normalizePurchasedAt("H31/5/10")).toBe("2019-05-10");
    });
    it("平成元年=1989年", () => {
      expect(normalizePurchasedAt("平成元年4月1日")).toBe("1989-04-01");
    });
  });

  describe("フォールバック", () => {
    it("null は今日 (JST)", () => {
      expect(normalizePurchasedAt(null)).toBe(todayJst());
    });
    it("undefined は今日 (JST)", () => {
      expect(normalizePurchasedAt(undefined)).toBe(todayJst());
    });
    it("空文字列は今日 (JST)", () => {
      expect(normalizePurchasedAt("")).toBe(todayJst());
      expect(normalizePurchasedAt("   ")).toBe(todayJst());
    });
    it("不正な文字列は今日 (JST)", () => {
      expect(normalizePurchasedAt("abc")).toBe(todayJst());
      expect(normalizePurchasedAt("May 10, 2026")).toBe(todayJst());
      expect(normalizePurchasedAt("26/5/10")).toBe(todayJst()); // 西暦下 2 桁は非対応
    });
  });
});
