// Supabase DB 型定義
// 実運用時は `supabase gen types typescript` で自動生成を推奨
// ここでは最小限の手書き型を定義
//
// マイグレーション: supabase/migrations/20260509000001_initial_schema.sql
// 詳細仕様: docs/design.md §4

export type UserRole = "admin" | "user";

export interface AllowedUser {
  id: string;
  email: string;
  role: UserRole;
  note: string | null;
  created_at: string;
}

export interface UserProfile {
  user_id: string;
  display_name: string | null;
  birth_year: number | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// expense_categories: カテゴリマスタ（標準 + ユーザー追加）
// =====================================================================
export interface ExpenseCategory {
  id: string;
  /** 標準カテゴリは null、ユーザー追加カテゴリは所有者の user_id */
  user_id: string | null;
  name: string;
  sort_order: number;
  is_default: boolean;
  created_at: string;
}

// =====================================================================
// recurring_expenses: 固定費テンプレート
// =====================================================================
export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  category_id: string;
  amount: number;
  /** 月次計上日 (1-31)。当月に存在しない日はアプリ側で月末日に丸める */
  day_of_month: number;
  active: boolean;
  /** 最後に生成した月の 1 日（YYYY-MM-01）。未生成なら null */
  last_generated_month: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

// =====================================================================
// expense_records / expense_items: 支出本体と明細
// =====================================================================
export type ExpenseSource = "receipt" | "manual" | "recurring";

export interface ExpenseRecord {
  id: string;
  user_id: string;
  /** ISO 8601 形式の timestamptz。OCR は時刻込みで返す。手入力時は 00:00:00 で保存。 */
  purchased_at: string;
  store_name: string | null;
  total_amount: number;
  note: string | null;
  image_paths: string[];
  source_type: ExpenseSource;
  /** 固定費自動計上由来なら recurring_expenses.id、それ以外は null */
  recurring_expense_id: string | null;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  expense_record_id: string;
  category_id: string;
  raw_name: string;
  display_name: string | null;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
  discount: number;
  created_at: string;
}

// expense_records と items を結合した表示用型
export type ExpenseRecordWithItems = ExpenseRecord & {
  expense_items: ExpenseItem[];
};
