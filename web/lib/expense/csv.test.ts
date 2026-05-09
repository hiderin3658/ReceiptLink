import { describe, expect, it } from "vitest";
import {
  buildCategoryNameMap,
  buildCsvFileName,
  buildExpenseCsv,
  escapeCsvCell,
  EXPENSE_CSV_HEADERS,
} from "./csv";
import type { ExpenseCategory, ExpenseRecordWithItems } from "@/types/database";

const CAT_FOOD = "11111111-1111-4111-8111-111111111111";
const CAT_DAILY = "22222222-2222-4222-8222-222222222222";

const sampleCategories: ExpenseCategory[] = [
  {
    id: CAT_FOOD,
    user_id: null,
    name: "食費",
    sort_order: 10,
    is_default: true,
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: CAT_DAILY,
    user_id: null,
    name: "日用品",
    sort_order: 20,
    is_default: true,
    created_at: "2026-04-01T00:00:00Z",
  },
];

const categoryNameById = buildCategoryNameMap(sampleCategories);

const baseItem = {
  id: "i1",
  expense_record_id: "r1",
  display_name: null,
  unit_price: null,
  created_at: "2026-04-29T00:00:00Z",
};

const sampleRecord: ExpenseRecordWithItems = {
  id: "r1",
  user_id: "u1",
  purchased_at: "2026-04-27T00:00:00Z",
  store_name: "ライフ",
  total_amount: 1623,
  note: null,
  image_paths: [],
  source_type: "receipt",
  recurring_expense_id: null,
  created_at: "2026-04-27T00:00:00Z",
  expense_items: [
    {
      ...baseItem,
      raw_name: "玉ねぎ",
      category_id: CAT_FOOD,
      quantity: 1,
      unit: "袋",
      total_price: 198,
      discount: 0,
    },
    {
      ...baseItem,
      id: "i2",
      raw_name: "豚ロース",
      category_id: CAT_FOOD,
      quantity: 1,
      unit: "パック",
      total_price: 398,
      discount: 30,
    },
  ],
};

describe("escapeCsvCell", () => {
  it("通常の文字列はそのまま", () => {
    expect(escapeCsvCell("豚ロース")).toBe("豚ロース");
  });

  it("数値は文字列化", () => {
    expect(escapeCsvCell(1623)).toBe("1623");
    expect(escapeCsvCell(0)).toBe("0");
  });

  it("null / undefined / 空文字 は空", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell("")).toBe("");
  });

  it("カンマを含む値はダブルクォートで囲む", () => {
    expect(escapeCsvCell("豚, ロース")).toBe('"豚, ロース"');
  });

  it("改行を含む値はダブルクォートで囲む", () => {
    expect(escapeCsvCell("メモ1\nメモ2")).toBe('"メモ1\nメモ2"');
  });

  it("ダブルクォートは二重化してダブルクォートで囲む", () => {
    expect(escapeCsvCell('彼は"こんにちは"と言った')).toBe(
      '"彼は""こんにちは""と言った"',
    );
  });

  // CSV Injection（Excel Formula Injection）対策
  it("'=' で始まる文字列は先頭にシングルクォートを付与", () => {
    expect(escapeCsvCell("=1+1")).toBe("'=1+1");
  });

  it("'+', '-', '@' で始まる文字列も同様", () => {
    expect(escapeCsvCell("+1234567")).toBe("'+1234567");
    expect(escapeCsvCell("-DDE()")).toBe("'-DDE()");
    expect(escapeCsvCell("@SUM(A1)")).toBe("'@SUM(A1)");
  });

  it("タブやキャリッジリターン始まりも対象", () => {
    expect(escapeCsvCell("\t=1+1")).toContain("'");
  });

  it("数値型は formula injection 対策不要（負の数は数値として残す）", () => {
    expect(escapeCsvCell(-100)).toBe("-100");
  });

  it("formula 文字とカンマが両方含まれる場合: 先頭にシングルクォート + 全体を quote", () => {
    const v = "=1, 2";
    const out = escapeCsvCell(v);
    expect(out).toBe("\"'=1, 2\"");
  });
});

describe("buildExpenseCsv", () => {
  it("空配列はヘッダーのみ", () => {
    const out = buildExpenseCsv([], categoryNameById);
    expect(out).toBe(EXPENSE_CSV_HEADERS.join(","));
  });

  it("ヘッダーが先頭行で 14 列ある", () => {
    const out = buildExpenseCsv([sampleRecord], categoryNameById);
    const lines = out.split("\r\n");
    expect(lines[0]).toBe(EXPENSE_CSV_HEADERS.join(","));
    expect(lines[0]!.split(",")).toHaveLength(14);
  });

  it("明細ごとに 1 行ずつ出力（同じ record の情報は繰り返し）", () => {
    const out = buildExpenseCsv([sampleRecord], categoryNameById);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(3); // header + 2 items
    expect(lines[1]).toContain("玉ねぎ");
    expect(lines[2]).toContain("豚ロース");
    // record 共通フィールドが各行に入る
    expect(lines[1]).toContain("ライフ");
    expect(lines[2]).toContain("ライフ");
  });

  it("カテゴリは categoryNameById の名前に変換", () => {
    const out = buildExpenseCsv([sampleRecord], categoryNameById);
    expect(out).toContain("食費");
  });

  it("マップに無いカテゴリは (削除済み) になる", () => {
    const orphan = { ...sampleRecord, expense_items: [{ ...sampleRecord.expense_items[0]!, category_id: "deleted-id" }] };
    const out = buildExpenseCsv([orphan], categoryNameById);
    expect(out).toContain("(削除済み)");
  });

  it("source_type は日本語ラベル化", () => {
    const out = buildExpenseCsv([sampleRecord], categoryNameById);
    expect(out).toContain("レシート");

    const manual = { ...sampleRecord, source_type: "manual" as const };
    const out2 = buildExpenseCsv([manual], categoryNameById);
    expect(out2).toContain("手入力");

    const recurring = { ...sampleRecord, source_type: "recurring" as const };
    const out3 = buildExpenseCsv([recurring], categoryNameById);
    expect(out3).toContain("固定費");
  });

  it("値引合計を行に転記", () => {
    const out = buildExpenseCsv([sampleRecord], categoryNameById);
    const lines = out.split("\r\n");
    // 5 列目（インデックス 4）が値引
    expect(lines[1]!.split(",")[4]).toBe("30");
  });

  it("明細が空の record も 1 行出力（記録ヘッダのみ）", () => {
    const empty: ExpenseRecordWithItems = {
      ...sampleRecord,
      expense_items: [],
    };
    const out = buildExpenseCsv([empty], categoryNameById);
    const lines = out.split("\r\n");
    expect(lines).toHaveLength(2);
    const cols = lines[1]!.split(",");
    expect(cols[5]).toBe(""); // 品名
    expect(cols[6]).toBe(""); // 表示名
  });

  it("カンマや改行を含むメモはエスケープされる", () => {
    const withSpecial: ExpenseRecordWithItems = {
      ...sampleRecord,
      note: "週末, 買い出し\n夜",
    };
    const out = buildExpenseCsv([withSpecial], categoryNameById);
    expect(out).toContain('"週末, 買い出し\n夜"');
  });

  it("店舗名に数式文字が含まれても安全に出力（先頭シングルクォート付与）", () => {
    const malicious: ExpenseRecordWithItems = {
      ...sampleRecord,
      store_name: "=cmd|'/c calc'!A1",
    };
    const out = buildExpenseCsv([malicious], categoryNameById);
    expect(out).toContain("'=cmd|");
  });
});

describe("buildCsvFileName", () => {
  it("YYYYMMDD-HHmm 形式 + .csv 拡張子", () => {
    const fn = buildCsvFileName(new Date("2026-04-29T03:05:00Z"));
    expect(fn).toMatch(/^receipt-link-expense-\d{8}-\d{4}\.csv$/);
  });

  it("特定時刻で正確な値", () => {
    const d = new Date(2026, 3, 29, 7, 8); // 2026-04-29 07:08 local
    const fn = buildCsvFileName(d);
    expect(fn).toBe("receipt-link-expense-20260429-0708.csv");
  });
});
