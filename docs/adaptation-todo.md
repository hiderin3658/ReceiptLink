# ReceiptLink 実装 TODO リスト

OkazuLink からコピーしたコードベースを家計簿アプリ「ReceiptLink」に書き換えるための作業リスト。

> **正式な要件・設計は [requirements.md](./requirements.md) / [design.md](./design.md) を参照。**
> 本ファイルは設計確定後の実装タスク管理のためのチェックリストです。

優先度: 🔴 必須 / 🟡 推奨 / 🟢 任意

---

## Phase 0: プロジェクトセットアップ ✅ 完了

- [x] 🔴 git リポジトリ初期化（`git init`）
- [x] 🔴 GitHub リポジトリ作成（`hiderin3658/ReceiptLink`）
- [x] 🔴 個人情報・実プロジェクト識別子のパージ
- [x] 🔴 ドキュメント整備（requirements.md / design.md / docs/legacy 移動）
- [ ] 🔴 `web/package.json` の `name` を `okazu-link-web` → `receipt-link-web` に変更
- [ ] 🔴 `web/package.json` の不要スクリプト削除（`seed:foods`, `backfill:food-ids`）
  - `gen:receipts` は**残す**（モックレシート生成に使用）
- [ ] 🔴 新規 Supabase プロジェクト作成（無料枠 / Tokyo リージョン）
- [ ] 🔴 `web/.env.local` を作成し新 Supabase の URL / anon key を設定
- [ ] 🔴 Supabase に Google OAuth プロバイダ設定（Google Cloud Console で OAuth クライアント発行）
- [ ] 🔴 `supabase/functions/.env` を作成し Gemini API キーを設定
- [ ] 🔴 `pnpm install` で依存関係インストール
- [ ] 🔴 `recharts` を依存に追加（`pnpm add recharts`）

---

## Phase 1: 不要コード削除

OkazuLink 由来で家計簿アプリに不要な部分を削除。

### 1.1 型定義
- [ ] 🔴 `web/types/database.ts` からレシピ・食材・楽天関連型をすべて削除
  - 削除対象: `Recipe`, `RecipeIngredient`, `SavedRecipe`, `RakutenRecipeCache`, `Cuisine`, `RecipeSource`, `ExternalRecipeProvider`, `RecipeSourcePreference`, `Food`, `FoodCategory`, `GoalType`
  - 当面残す: `AllowedUser`, `UserRole`, `ShoppingRecord`, `ShoppingItem` （後の Phase 3 で `Expense*` にリネーム）

### 1.2 ナビゲーション
- [ ] 🔴 `web/components/layout/bottom-nav.tsx` を 4 メニュー化（ホーム / 履歴 / 追加+ / 設定）
- [ ] 🔴 `web/components/layout/side-nav.tsx` 同様に整理

### 1.3 ライブラリ
- [ ] 🟡 `web/lib/shopping/attach-food-ids.ts` 削除（食材マスタ紐付け不要）
- [ ] 🟡 `web/lib/shopping/aggregations.ts` の食材ベースロジック削除（後で家計簿用に書き直し）

### 1.4 マイグレーション
- [ ] 🔴 既存 3 ファイルを削除予定リストに追加（Phase 2 で新規ファイルに統合）
  - `20260421000001_phase0_schema.sql`
  - `20260421000002_phase1_shopping_recipes.sql`
  - `20260421000004_storage_buckets.sql`
- [ ] 🟡 `supabase/seed.sql` から食材マスタ関連シードを削除

---

## Phase 2: データモデル再設計

[design.md §4](./design.md) の通りに DB スキーマを再構築。

- [ ] 🔴 新規マイグレーション `supabase/migrations/20260509000001_initial_schema.sql` を作成
  - enum: `user_role`, `expense_source`, `ai_kind`
  - ヘルパー関数: `current_email`, `is_admin`, `set_updated_at`
  - テーブル: `allowed_users`, `user_profiles`, `expense_categories`, `recurring_expenses`, `expense_records`, `expense_items`, `ai_advice_logs`
  - 各テーブルに RLS ポリシー
  - `expense_categories` 標準 6 種をシード INSERT
- [ ] 🔴 新規マイグレーション `supabase/migrations/20260509000002_storage_buckets.sql`
  - `receipts` バケット定義 + Storage RLS
- [ ] 🔴 旧マイグレーション 3 ファイルを削除
- [ ] 🔴 `supabase db reset` でローカル DB 初期化テスト

---

## Phase 3: ドメインロジック書き換え

### 3.1 リネーム
- [ ] 🔴 `web/lib/shopping/` → `web/lib/expense/`
- [ ] 🔴 `web/components/shopping/` → `web/components/expense/`
- [ ] 🔴 `web/app/(app)/shopping/` → `web/app/(app)/expense/`
- [ ] 🔴 import パス・URL 参照を一括修正

### 3.2 スキーマ・ロジック
- [ ] 🔴 `web/lib/expense/schema.ts`
  - `food_id` 削除、`category_id`（FK to `expense_categories`）追加
  - `food_category` enum 参照を削除
- [ ] 🔴 `web/lib/expense/actions.ts`
  - INSERT 先テーブルを `expense_records` / `expense_items` に
- [ ] 🔴 `web/lib/expense/aggregations.ts` 新規実装
  - 月次合計
  - カテゴリ別合計
  - 今日までのペース計算
  - 月次推移（過去 N ヶ月）
- [ ] 🔴 `web/lib/expense/recurring.ts` 新規実装
  - 未生成の固定費を計算（[design.md §7.1](./design.md)）
  - 生成 Server Action（差分 INSERT + `last_generated_month` 更新）
  - **月末丸めロジック**: `day_of_month` が当月に存在しない場合（例: 2 月の 31 日）は当月の月末日に丸める純粋関数 `resolveDayOfMonth(year, month, dayOfMonth): Date` を実装し、ユニットテストを追加
- [ ] 🟡 `web/lib/expense/csv.ts`
  - 出力カラムを家計簿用に変更（[design.md §9](./design.md)）

### 3.3 Edge Function
- [ ] 🟡 `supabase/functions/extract-receipt/index.ts` のプロンプト調整
  - 商品全般の抽出
  - 各品目に `category_hint`（標準 6 種）を出力させる
  - 店舗カテゴリヒント（任意）
- [ ] 🟡 `supabase/functions/extract-receipt/validate.ts` の zod スキーマを家計簿版に拡張
- [ ] 🟡 `ai_kind` enum を OCR 系のみ（`ocr`, `ocr_fallback`）に整理（既存に他の値があれば削除）

---

## Phase 4: UI 改修

### 4.1 既存画面の改修
- [ ] 🔴 `expense/receipt-uploader.tsx`（旧 shopping/receipt-uploader.tsx）
  - 文言を「買物」→「支出」へ
- [ ] 🔴 `expense/expense-form.tsx`（旧 shopping-form.tsx）
  - カテゴリ選択を `expense_categories` ドロップダウンに
  - 各品目ごとにカテゴリ選択
- [ ] 🔴 `web/app/(app)/expense/page.tsx`（履歴一覧）
  - タイトル・文言を支出系に
- [ ] 🔴 `web/app/(app)/expense/[id]/page.tsx`（詳細）
  - 同上
- [ ] 🔴 `web/app/(app)/expense/new/page.tsx`（新規）
  - 「レシートで」「手入力で」の入口を提示

### 4.2 新規画面
- [ ] 🔴 `web/app/(app)/dashboard/page.tsx` 新規作成
  - 今月合計・ペース表示
  - カテゴリ別円グラフ（Recharts）
  - 未計上固定費アラート
- [ ] 🔴 `web/app/(app)/reports/page.tsx` 新規作成
  - 月次推移棒グラフ（Recharts）
  - カテゴリ別円グラフ
  - 前月比
  - CSV ダウンロード
- [ ] 🔴 `web/app/(app)/settings/page.tsx` 新規作成
  - プロフィール
  - カテゴリ管理（追加・編集・削除）
  - 固定費管理（追加・編集・削除・停止）
  - admin: ホワイトリスト管理

### 4.3 共通コンポーネント
- [ ] 🟡 `web/components/charts/CategoryPie.tsx` 新規（Recharts ラッパー）
- [ ] 🟡 `web/components/charts/MonthlyBar.tsx` 新規（Recharts ラッパー）

---

## Phase 5: 固定費機能 + レポート機能

[design.md §7](./design.md) の通りに実装。

- [ ] 🔴 `recurring_expenses` の CRUD UI（Phase 4 settings ページ内）
- [ ] 🔴 ダッシュボードでの「未計上固定費」検出 + 一括登録ボタン
- [ ] 🔴 一括登録 Server Action（差分計算 + INSERT + `last_generated_month` 更新）
- [ ] 🔴 月次レポートページ実装

---

## Phase 6: ブランディング・デプロイ

- [ ] 🔴 アプリ名・タイトル・メタ情報を ReceiptLink に変更
  - `web/app/layout.tsx`（`<title>`, `<meta name="description">`）
  - `web/public/manifest.webmanifest`
- [ ] 🟡 ロゴ・ファビコン作成
- [ ] 🟡 `web/public/icons/` のアイコン差し替え
- [ ] 🟡 OG 画像作成
- [ ] 🟡 Vercel プロジェクト作成・接続
- [ ] 🟢 ドメイン取得（任意）

---

## Phase 7: テスト

- [ ] 🔴 既存ユニットテストを通す（`pnpm test`）
  - レシピ関連テストは削除
  - schema / actions のテストを家計簿用に書き換え
- [ ] 🟡 家計簿固有ロジックのユニットテスト追加
  - `aggregations.test.ts`（月次合計・カテゴリ別・ペース）
  - `recurring.test.ts`（次回生成月の計算）
- [ ] 🟡 E2E テスト（Playwright）を新規作成
  - シナリオ 1: ログイン → レシート登録 → 履歴確認
  - シナリオ 2: 手入力 → 編集 → 削除
  - シナリオ 3: 固定費登録 → 翌月の自動計上提案
- [ ] 🟡 モックレシート（`web/scripts/mock-receipts/output/*.pdf`）で OCR 精度を検証
  - 既存 10 種類: マルハチ / ライフ / ダイクマ
  - 追加生成: ドラッグストア / コンビニ / 日用品店

---

## メモ

- **OkazuLink の改善が ReceiptLink にも適用したい場合**は、対応コミットを手動で `cherry-pick` または差分を見て手動反映する
- 半年〜1年後、両アプリで「明らかに同じ」コードが残っていれば、共通モジュール化を検討
