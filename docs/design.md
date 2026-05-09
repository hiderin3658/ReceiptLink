# ReceiptLink 設計書

> レシート写真を撮るだけで家計簿が完成するアプリの設計書。

- 作成日: 2026-05-09
- バージョン: 1.0
- 関連ドキュメント:
  - [要件定義書](./requirements.md)
  - [認証・OCR 共通仕様](./receipt-scan-spec.md)
  - [実装 TODO](./adaptation-todo.md)

---

## 1. 技術スタック

| レイヤ | 技術 | 備考 |
|---|---|---|
| フロントエンド | Next.js 15 (App Router) + React 19 + TypeScript | OkazuLink から継承 |
| スタイリング | Tailwind CSS v4 | 同上 |
| グラフ | Recharts | **新規追加**（円グラフ・棒グラフ） |
| バックエンド | Supabase (Postgres / Auth / Storage / Edge Functions) | OkazuLink と別プロジェクト |
| AI | Gemini 3 Flash（OCR） + Pro（フォールバック） | OkazuLink から継承 |
| テスト | Vitest（ユニット） + Playwright（E2E） | OkazuLink から継承 |
| ホスティング | Vercel + Supabase Cloud | 無料枠運用 |

---

## 2. アーキテクチャ概要

```
┌──────────────────┐       ┌──────────────────────┐
│  Browser (Mobile │       │  Vercel (Next.js 15) │
│  / PC) — 操作    │ ◄───► │  - App Router        │
└──────────────────┘       │  - Server Actions    │
         │                 │  - Server Components │
         │                 └──────────┬───────────┘
         │                            │
         │   レシート画像 直アップ        │ DB アクセス
         │ (Supabase JS Client)         │ (server.ts)
         ▼                            ▼
┌──────────────────────────────────────────────────┐
│  Supabase                                       │
│  ├─ Postgres (RLS)                              │
│  │   └ allowed_users / expense_categories /     │
│  │     expense_records / expense_items /        │
│  │     recurring_expenses / ai_advice_logs      │
│  ├─ Auth (Google OAuth)                         │
│  ├─ Storage (receipts バケット プライベート)        │
│  └─ Edge Functions                              │
│      └ extract-receipt (Gemini API 呼び出し)     │
└──────────────────────────────────────────────────┘
                              │
                              ▼
                      ┌──────────────────┐
                      │  Google AI Studio│
                      │  (Gemini 3)      │
                      └──────────────────┘
```

### 2.1 主要なフロー

1. **レシート登録**: ブラウザ → Supabase Storage に画像アップ → Server Action 経由で `extract-receipt` Edge Function を呼ぶ → JSON レスポンスをフォームへ → ユーザー編集 → Server Action で `expense_records` / `expense_items` に INSERT
2. **集計表示**: Server Component で `expense_items` を集計 → カテゴリ別合計を Recharts に渡す
3. **固定費自動計上**: ダッシュボード初回アクセス時に「未計上の固定費があれば一括登録」を提示 → ユーザー確認 → Server Action で INSERT

---

## 3. 認証・認可

### 3.1 認証
- **Google OAuth 2.0**（Supabase Auth）
- 詳細フロー: [receipt-scan-spec.md §1](./receipt-scan-spec.md)

### 3.2 認可（ロール）

`public.user_role` enum: `admin` / `user`

| ロール | 主な操作 | 想定ユーザー |
|---|---|---|
| `admin` | ホワイトリスト管理 / 標準カテゴリ編集 / 自分の家計簿入力 | 依頼者本人（オーナー） |
| `user` | 自分の家計簿データの登録・閲覧・編集のみ | 追加された世帯メンバー |

### 3.3 ホワイトリスト
- `allowed_users` テーブルに登録された email のみログイン可
- ログイン直後の Server Component で `allowed_users` 照合 → 未登録なら `/login?reason=not_allowed` へ即リダイレクト
- セットアップ時、admin の email を 1 件 SQL で投入

### 3.4 アクセス制御方針
- **middleware は使用しない**（Edge Runtime 互換性問題回避）
- Server Component / Route Handler の冒頭で `supabase.auth.getUser()` + ホワイトリスト照合
- DB 側は **RLS** で `user_id = auth.uid()` を強制

---

## 4. データモデル

### 4.1 テーブル一覧

| テーブル | 役割 | RLS 主方針 |
|---|---|---|
| `allowed_users` | ログイン許可 email + ロール | self select / admin all |
| `user_profiles` | ユーザー追加情報（表示名等） | self all |
| `expense_categories` | カテゴリマスタ（標準 + ユーザー追加） | 標準は全員 read / 自分のは self all / 標準は admin write |
| `expense_records` | 支出 1 件（レシート単位 or 手入力 1 回） | self all |
| `expense_items` | 支出の品目内訳 | 親 record 経由で self all |
| `recurring_expenses` | 固定費テンプレート | self all |
| `ai_advice_logs` | AI 呼び出しログ（OCR） | self select / Edge Function (service_role) のみ insert |

`shopping_records` / `shopping_items` / `recipes` / `recipe_ingredients` / `saved_recipes` / `rakuten_recipe_cache` / `foods` / `food_category` enum / `goal_type` enum は **全削除**（OkazuLink 由来、家計簿では不要）。

### 4.2 enum

```sql
create type public.user_role as enum ('admin', 'user');
create type public.expense_source as enum ('receipt', 'manual', 'recurring');
create type public.ai_kind as enum ('ocr', 'ocr_fallback');
```

### 4.3 主要テーブル定義（抜粋）

#### `allowed_users`（OkazuLink 流用）
```sql
create table public.allowed_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email)),
  role public.user_role not null default 'user',
  note text,
  created_at timestamptz not null default now()
);
```

#### `expense_categories`
```sql
create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  -- NULL なら標準カテゴリ（全員参照可、admin のみ編集）
  -- non-NULL なら所有ユーザーが追加したカスタムカテゴリ
  name text not null,
  sort_order int not null default 100,
  is_default boolean not null default false,  -- true なら削除不可
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
```

シード（標準カテゴリ）:
| name | sort_order | is_default |
|---|---|---|
| 食費 | 10 | true |
| 日用品 | 20 | true |
| 光熱費 | 30 | true |
| 交通費 | 40 | true |
| 娯楽 | 50 | true |
| その他 | 99 | true |

#### `expense_records`
```sql
create table public.expense_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purchased_at date not null,
  store_name text,
  total_amount int not null default 0,
  note text,
  image_paths text[] not null default '{}',
  source_type public.expense_source not null default 'receipt',
  recurring_expense_id uuid references public.recurring_expenses(id) on delete set null,
  created_at timestamptz not null default now()
);
create index expense_records_user_date_idx on public.expense_records (user_id, purchased_at desc);
```

#### `expense_items`
```sql
create table public.expense_items (
  id uuid primary key default gen_random_uuid(),
  expense_record_id uuid not null references public.expense_records(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  raw_name text not null,                 -- OCR 抽出時のオリジナル品名
  display_name text,                      -- ユーザー編集後の表示名
  quantity numeric(10, 3),
  unit text,
  unit_price int,
  total_price int not null default 0,
  discount int not null default 0,
  created_at timestamptz not null default now()
);
create index expense_items_record_idx on public.expense_items (expense_record_id);
create index expense_items_category_idx on public.expense_items (category_id);
```

#### `recurring_expenses`
```sql
create table public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,                    -- 例: 家賃, Netflix, 電気代
  category_id uuid not null references public.expense_categories(id) on delete restrict,
  amount int not null,
  day_of_month int not null check (day_of_month between 1 and 28),  -- 月次計上日
  active boolean not null default true,
  last_generated_month date,             -- 最後に生成した月の 1 日（重複防止）
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

> **設計判断**: `day_of_month` を 1〜28 に制限することで、月末判定の複雑さを回避。29 日以降の固定費は実用上稀なため許容範囲。

### 4.4 マイグレーション戦略

- 既存マイグレーション 3 ファイルを **すべて削除**し、新規 1 ファイル `20260509000001_initial_schema.sql` に統合
- 履歴を持ち込まないことで Supabase プロジェクト初期化が clean

新マイグレーション構成（順序）:
1. 拡張 (pgcrypto)
2. enum 定義
3. ヘルパー関数 (`current_email`, `is_admin`, `set_updated_at`)
4. `allowed_users` + RLS
5. `user_profiles` + RLS
6. `expense_categories` + RLS + シード
7. `recurring_expenses` + RLS
8. `expense_records` + RLS
9. `expense_items` + RLS
10. `ai_advice_logs` + RLS
11. Storage バケット `receipts` + RLS（別ファイル `20260509000002_storage_buckets.sql`）

---

## 5. 画面設計

### 5.1 画面一覧

| ID | URL | 画面名 | 主役割 | デバイス優先 |
|---|---|---|---|---|
| S-LOGIN | `/login` | ログイン | Google OAuth ボタン | スマホ |
| S-DASH | `/dashboard` | ダッシュボード（ホーム） | 今月合計 / ペース / カテゴリ円グラフ / 固定費未計上アラート | スマホ |
| S-EXP-LIST | `/expense` | 支出履歴一覧 | 月別の支出リスト（無限スクロール or ページング） | スマホ |
| S-EXP-NEW | `/expense/new` | 新規支出登録 | 「レシートで」「手入力で」を選択 → 各フロー | スマホ |
| S-EXP-DETAIL | `/expense/[id]` | 支出詳細 | 品目内訳 + レシート画像 + 編集・削除 | スマホ |
| S-REPORT | `/reports` | 月次レポート | 円グラフ + 月次推移棒グラフ + CSV エクスポート | PC |
| S-SETTINGS | `/settings` | 設定 | プロフィール / カテゴリ管理 / 固定費管理 / (admin) ホワイトリスト | PC |

### 5.2 画面遷移

```
                              ┌──────────────┐
                              │  /login      │
                              └──────┬───────┘
                                     │ Google OAuth 成功 + ホワイトリスト OK
                                     ▼
              ┌──────────────────────────────────────┐
              │       /dashboard (S-DASH)            │
              │  - 今月合計 / ペース                   │
              │  - カテゴリ別円グラフ                   │
              │  - 未計上の固定費アラート               │
              └──────┬─────────────┬─────────┬───────┘
                     │             │         │
                     ▼             ▼         ▼
          /expense        /reports      /settings
          (履歴一覧)       (月次レポート)   (設定)
              │
              ├─► /expense/new ──► /expense/[id] (保存後)
              └─► /expense/[id] (履歴クリック)
```

### 5.3 ナビゲーション
- スマホ: 下部固定の `BottomNav`（4 アイコン: ホーム / 履歴 / 追加+ / 設定）
- PC: 左サイド固定の `SideNav`（テキスト + アイコン）
- 「追加+」はモーダルでなく `/expense/new` への遷移とする（戻るボタンの挙動を素直にするため）

---

## 6. レシート OCR フロー

### 6.1 フロー概要
1. ユーザーが `/expense/new` で「レシートで登録」を選択
2. `<input type="file" capture="environment">` でカメラ起動 or ファイル選択
3. クライアントから Supabase Storage の `receipts/{user_id}/{uuid}.{ext}` に直接アップロード
4. アップ完了後、Server Action 経由で `extract-receipt` Edge Function を呼び出し
5. Edge Function が Gemini API に画像 + プロンプトを送信、構造化 JSON を返す
6. クライアントはレスポンスを `ExpenseForm` に流し込み、ユーザーが内容確認・修正
7. 「保存」で Server Action → `expense_records` / `expense_items` に INSERT

### 6.2 OCR プロンプト変更点（OkazuLink との差分）
- **食材抽出 → 商品全般抽出**（「シャンプー」「電池」等も対象）
- **カテゴリ推定を追加**: プロンプトに 6 種の標準カテゴリ名を提示し、各品目に推定カテゴリ名を出力させる
- 店舗カテゴリ（コンビニ / スーパー / ドラッグストア）も推定可能なら出力

### 6.3 抽出 JSON スキーマ（家計簿版）

```json
{
  "store_name": "ライフ ○○店",
  "store_category_hint": "supermarket",
  "purchased_at": "2026-05-08T18:32:00",
  "items": [
    {
      "name": "豚こま切れ",
      "quantity": 1,
      "unit": "パック",
      "unit_price": 398,
      "total_price": 398,
      "discount": 0,
      "category_hint": "食費"
    },
    {
      "name": "シャンプー",
      "quantity": 1,
      "unit": "個",
      "unit_price": 698,
      "total_price": 698,
      "discount": 0,
      "category_hint": "日用品"
    }
  ],
  "subtotal": 1096,
  "discount": 0,
  "total_amount": 1096
}
```

### 6.4 カテゴリマッチング
- Gemini の `category_hint` を `expense_categories.name` と完全一致でマッチング
- マッチしなければ「その他」にフォールバック
- ユーザーは画面で各品目のカテゴリをドロップダウンで自由に変更可能

### 6.5 エラー処理
- Flash 失敗 → Pro リトライ（既存実装そのまま）
- Pro も失敗 → ユーザーに「読み取りに失敗しました。手入力で続けますか?」を提示し、空の `ExpenseForm` を表示
- すべての OCR 呼び出しは `ai_advice_logs` に記録

---

## 7. 固定費自動計上

### 7.1 アルゴリズム

ユーザーが `/dashboard` を開いたタイミングで、Server Component が以下を実行:

```
for each rec in 自分の active な recurring_expenses:
  最後の生成月 = rec.last_generated_month
  当月 1 日 = trunc(today, 'month')
  while 最後の生成月 < 当月:
    生成対象月 = 最後の生成月 + 1 month（初回は ((rec.created_at の月) または 当月) のいずれか早い方の翌月）
    purchased_at = 生成対象月 の day_of_month 日
    expense_records (source_type = 'recurring', recurring_expense_id = rec.id) を INSERT
    expense_items (1 件、name = rec.name, total_price = rec.amount) を INSERT
    rec.last_generated_month = 生成対象月
```

> **設計判断**: 自動 INSERT ではなく **「未計上の固定費があります。N 件を登録しますか?」というアラート → ユーザー操作で INSERT** とする。理由:
> - 月途中での金額変更や停止（解約）に対応しやすい
> - cron（pg_cron）導入を MVP では避けられる
> - ユーザーの操作なしにレコードが生まれる「不気味さ」を回避

### 7.2 重複防止
- `recurring_expenses.last_generated_month` で「最後に生成した月の 1 日」を記録
- 同じ月で 2 回 INSERT されないことを担保

### 7.3 削除・停止
- `active = false` で停止（過去レコードは残す）
- 削除時は `expense_records.recurring_expense_id` が `set null` で関連を切断

---

## 8. 集計・レポート

### 8.1 ダッシュボード（S-DASH）

| 要素 | データソース | 計算方法 |
|---|---|---|
| 今月の合計 | `expense_items.total_price - discount` を today_month で sum | サーバ側集計 |
| 今日までのペース | (今月合計) ÷ (今月の経過日数) × (今月の総日数) | サーバ側集計 |
| カテゴリ別円グラフ | カテゴリごとに集計 | Recharts `<PieChart>` |
| 未計上固定費アラート | §7.1 の差分 | サーバ側計算 |

### 8.2 月次レポート（S-REPORT）

| 要素 | 内容 |
|---|---|
| 月次推移棒グラフ | 過去 6 ヶ月（デフォ） / 12 ヶ月（切替） の月合計 |
| カテゴリ別円グラフ | 当月の内訳（ダッシュボードと同じ） |
| 前月比 | (今月合計 - 前月合計) / 前月合計 × 100% |
| CSV エクスポート | 月選択 → ダウンロード（既存実装流用） |

---

## 9. CSV エクスポート

OkazuLink の `web/lib/shopping/csv.ts` を流用し、以下のカラム構成へ変更:

| カラム | 説明 |
|---|---|
| 日付 | `expense_records.purchased_at` |
| 店舗 | `expense_records.store_name` |
| 品名 | `expense_items.display_name ?? raw_name` |
| カテゴリ | `expense_categories.name` |
| 数量 | `expense_items.quantity` |
| 単位 | `expense_items.unit` |
| 単価 | `expense_items.unit_price` |
| 金額 | `expense_items.total_price` |
| 値引 | `expense_items.discount` |
| メモ | `expense_records.note` |
| ソース | `receipt` / `manual` / `recurring` |

文字コード: UTF-8 with BOM（Excel での文字化け回避）

---

## 10. テスト方針

### 10.1 ユニットテスト（Vitest）

優先度高:
- `lib/expense/schema.ts` (zod)
- `lib/expense/aggregations.ts`（カテゴリ別集計 / ペース計算）
- `lib/expense/csv.ts`
- `lib/expense/recurring.ts`（次回生成月の計算）

OkazuLink から流用したテスト:
- `supabase/functions/_shared/sanitize.test.ts`
- `supabase/functions/_shared/hash.test.ts`
- `supabase/functions/_shared/gemini.test.ts`
- `supabase/functions/extract-receipt/validate.test.ts`（zod スキーマを家計簿用に書き換え後）

### 10.2 E2E（Playwright）— Phase 7 で実施

主要シナリオ（最低 3 本）:
1. ログイン → ホーム表示 → 「レシートで登録」→ モックレシート PDF アップロード → OCR 結果編集 → 保存 → 履歴で確認
2. 手入力で支出追加 → 履歴で確認 → 編集 → 削除
3. 固定費登録 → 翌月になったら自動計上提案が出ることを確認

### 10.3 モックレシート
- `web/scripts/mock-receipts/` を流用
- 既存 10 種（食品系）に加え、家計簿向け「ドラッグストア」「コンビニ」「日用品店」のモックを追加生成

---

## 11. ロードマップ

| Phase | 内容 | 期間目安 |
|---|---|---|
| Phase 0 | プロジェクトセットアップ（GitHub / Supabase / Vercel） | 1 日 |
| Phase 1 | 不要コード削除（OkazuLink 由来のレシピ・栄養関連） | 1 日 |
| Phase 2 | DB マイグレーション統合・書き直し | 1 日 |
| Phase 3 | ドメインロジック書き換え（`shopping/` → `expense/`） | 2 日 |
| Phase 4 | UI 改修（ナビ / フォーム / ダッシュボード新規） | 3 日 |
| Phase 5 | 固定費機能 + レポート機能 | 2 日 |
| Phase 6 | ブランディング（タイトル / マニフェスト） + Vercel デプロイ | 1 日 |
| Phase 7 | テスト + バグ修正 | 2 日 |
| **合計** | **MVP リリース** | **約 13 営業日 ≒ 1.5〜2 週間** |

詳細タスクは [`adaptation-todo.md`](./adaptation-todo.md) を参照。

---

## 12. 設計上の決定事項一覧

| ID | 決定 | 理由 |
|---|---|---|
| D-01 | DB マイグレーションは新規 1 ファイルに統合し、OkazuLink 由来は破棄 | 履歴を持ち込まず Supabase プロジェクト初期化が clean |
| D-02 | カテゴリは enum でなくマスタテーブル | ユーザー追加対応のため |
| D-03 | 予算機能は MVP 対象外 | 短納期優先・要件で確認済み |
| D-04 | 固定費は ダッシュボード閲覧時の差分計算 + ユーザー確認 INSERT | pg_cron 不要、停止・金額変更に強い |
| D-05 | 中間モデル（household 等）を持たず単独ユーザー前提 | MVP で不要、後で拡張可能（user_id を household_id に置き換え可） |
| D-06 | ホワイトリスト方式を維持（OkazuLink 流用） | 不特定多数のサインアップを防止 |
| D-07 | グラフは Recharts のみ追加（他のチャートライブラリは選ばない） | 依存最小化、円・棒の両方をカバー |
| D-08 | OCR でカテゴリヒントも返してもらう（追加プロンプト） | 後段の手動修正コストを下げる |
| D-09 | `day_of_month` は 1〜28 に制限 | 月末日変動の複雑さ回避 |
| D-10 | middleware を使わずサーバコンポーネントでガード | Edge Runtime 互換性問題回避（OkazuLink から継承） |

---

## 13. 今後の検討事項（Phase 2 以降）

- 月次予算機能（カテゴリ別 + 全体）
- 銀行・クレカ明細の取込（CSV インポート → OCR 不要）
- 世帯共有機能（`households` / `household_members` テーブル追加）
- マネーフォワード / Zaim 互換 CSV
- レシート画像の OCR キャッシュ（同一画像の再 OCR 回避）
- PWA 拡充（オフライン入力）
