# ReceiptLink 実装計画

> 設計書 [`design.md`](./design.md) §11 のロードマップを **PR 単位の実行計画** に落とし込んだもの。
> 詳細タスク一覧は [`adaptation-todo.md`](./adaptation-todo.md) を参照。

- 作成日: 2026-05-09
- 対象: MVP リリース（Phase 1 〜 Phase 7）
- 想定期間: **約 2 週間（8〜10 営業日）**
- リリース目標: 2026-05-23 頃

---

## 1. 全体方針

### 1.1 進め方
1. **Phase 単位ではなく PR 単位**で進める（依存関係に従って 7 PR）。
2. **各 PR の完了条件 = 「main にマージしてもアプリが壊れない」**。
3. UI を伴う PR は、**実機（スマホ + PC）で golden path を 1 回手動確認**してから PR 化する。
4. リファクタ系の PR では既存テスト（`pnpm test`）がグリーンであることを確認する。

### 1.2 ブランチ命名
- 機能追加: `feature/<short-description>`
- 修正のみ: `fix/<short-description>`
- ドキュメント: `docs/<short-description>`
- 例: `feature/phase1-implementation`, `feature/db-rebuild`, `feature/dashboard`

### 1.3 リスク管理
- **Supabase プロジェクトの初回セットアップは PR-2 着手前に完了させる**（DB マイグレーションが本番に当たる）
- **既存マイグレーション削除（PR-2）は破壊的**。OkazuLink 側に影響しないことを明示しておく（別プロジェクトのため影響なし）
- 急ぎ案件のため、**E2E テスト（Phase 7）は時間が許す範囲で実施**する妥協案も視野

---

## 2. 機能スコープ（再掲）

設計書 [`design.md`](./design.md) §3〜§9 の通り。MVP では以下を実装:

| ID | 機能 | 担当 PR |
|---|---|---|
| F-AUTH-01〜03 | Google OAuth + ホワイトリスト | 既存（OkazuLink から継承） |
| F-AUTH-04 | ホワイトリスト管理 UI | PR-6 |
| F-INPUT-01〜04 | レシート OCR / 手入力 | PR-3, PR-4 |
| F-INPUT-05〜07 | 固定費登録・自動計上 | PR-5 |
| F-LIST-01〜03 | 履歴・詳細・編集 | PR-4 |
| F-REPORT-01〜04 | ダッシュボード + レポート | PR-5, PR-6 |
| F-CAT-01〜02 | カテゴリ管理 | PR-2（シード）, PR-6（管理 UI） |
| F-EXPORT-01 | CSV エクスポート | PR-4 |

### スコープ外（Phase 2 以降）
- 月次予算機能（F-REPORT-05 の前月比は MVP に含むが、予算超過警告は対象外）
- 銀行・クレカ明細取込
- 世帯共有（`households` テーブル）
- マネーフォワード / Zaim 互換 CSV
- PWA オフライン対応の拡充

---

## 3. PR 分割計画（合計 7 PR）

### PR-1: Phase 1 — 不要コード削除 + 実装計画 ★ 着手中

**ブランチ**: `feature/phase1-implementation`
**目的**: OkazuLink 由来でこのアプリに不要な部分を整理し、後続 PR の作業範囲を狭める。実装計画の合意もここで取る。

**含む**:
- `docs/implementation-plan.md` 新規作成
- `web/types/database.ts` からレシピ・食材系型を削除
  - 削除: `Recipe`, `RecipeIngredient`, `SavedRecipe`, `RakutenRecipeCache`, `Cuisine`, `RecipeSource`, `ExternalRecipeProvider`, `RecipeSourcePreference`, `Food`, `FoodCategory`, `FOOD_CATEGORIES`, `FOOD_CATEGORY_LABEL`, `CUISINES`, `CUISINE_LABEL`, `EXTERNAL_RECIPE_PROVIDERS`, `RECIPE_SOURCE_PREFERENCES`, `RECIPE_SOURCE_PREFERENCE_LABEL`, `GOAL_TYPES`, `GoalType`, `GOAL_TYPE_LABEL`
  - 残す: `AllowedUser`, `UserRole`, `UserProfile`（後続 PR で家計簿用に再定義）, `ShoppingRecord`, `ShoppingItem`, `ShoppingRecordWithItems`, `ShoppingSource`（PR-3 で expense 系にリネーム）
- `web/lib/shopping/attach-food-ids.ts` + テスト 削除
- `web/lib/shopping/aggregations.ts` の食材ベース集計を削除（純粋な金額集計のみ残す or 全削除）
- ナビゲーション整理:
  - `web/components/layout/bottom-nav.tsx`: メニューを「ホーム / 履歴 / 追加+ / 設定」の 4 つに
  - `web/components/layout/side-nav.tsx`: 同様
- `package.json` からレシピ・食材関連スクリプト削除（`seed:foods`, `backfill:food-ids` など、存在すれば）
- ビルド・型チェック・既存テストがグリーンであることを確認

**含まない**: DB スキーマ変更、`shopping/` のリネーム、新画面追加、ロジック改修

**工数**: 1 日
**依存**: なし

---

### PR-2: Phase 2 — DB スキーマ再構築 + recharts 追加

**ブランチ**: `feature/db-rebuild`
**目的**: 家計簿用 DB スキーマに置き換え、グラフ用ライブラリを追加して後続 PR の前提を整える。

**含む**:
- 旧マイグレーション 3 ファイル削除
  - `supabase/migrations/20260421000001_phase0_schema.sql`
  - `supabase/migrations/20260421000002_phase1_shopping_recipes.sql`
  - `supabase/migrations/20260421000004_storage_buckets.sql`
- 新規マイグレーション作成
  - `supabase/migrations/20260509000001_initial_schema.sql`（[design.md §4](./design.md) 通り）
  - `supabase/migrations/20260509000002_storage_buckets.sql`（receipts バケット定義）
- 標準カテゴリ 6 種のシード
- `supabase/seed.sql` 更新（食材マスタ系シードを削除、admin email 追加箇所のみ残す）
- `web/types/database.ts` に新スキーマ準拠の型を追加
  - `ExpenseCategory`, `ExpenseRecord`, `ExpenseItem`, `RecurringExpense`, `ExpenseSource`
- `recharts` を依存に追加（`pnpm add recharts`）
- ローカルで `supabase db reset` を実行して動作確認
- README にセットアップ手順を反映（必要なら）

**含まない**: アプリ層のロジック書き換え、UI 改修

**工数**: 1 日
**依存**: PR-1（型定義の整理が前提）
**前提**: 新規 Supabase プロジェクト作成済み（依頼者環境）

---

### PR-3: Phase 3 — shopping → expense リネーム + ドメインロジック書き換え + Edge Function 調整

**ブランチ**: `feature/expense-domain`
**目的**: ファイル名・ロジック・OCR プロンプトを家計簿モデルに合わせる。アプリは「動く」状態を維持。

**含む**:
- ディレクトリ・ファイルリネーム
  - `web/lib/shopping/` → `web/lib/expense/`
  - `web/components/shopping/` → `web/components/expense/`
  - `web/app/(app)/shopping/` → `web/app/(app)/expense/`
  - `web/app/api/shopping/` → `web/app/api/expense/`
  - 個別ファイルも `shopping-*.tsx` → `expense-*.tsx` 等へ
- import パス・URL 一括修正
- `web/lib/expense/schema.ts`
  - `food_id`/`food_category` 削除、`category_id`（FK）を必須化
- `web/lib/expense/actions.ts`
  - INSERT 先テーブルを `expense_records` / `expense_items` に
  - 親子トランザクション維持
- `web/lib/expense/aggregations.ts` 新規実装
  - `monthlyTotal(items, yearMonth)` 月次合計
  - `categoryBreakdown(items, yearMonth)` カテゴリ別内訳
  - `paceForMonth(monthlyTotal, today)` 今日までのペース
  - `monthlyHistory(items, months)` 月次推移
- `web/lib/expense/recurring.ts` 新規実装
  - `pendingMonths(rec, today)` 未生成月の配列を返す純粋関数
  - `generatePending(supabase, userId, today)` Server Action
- `web/lib/expense/csv.ts` カラム変更（[design.md §9](./design.md)）
- `supabase/functions/extract-receipt/index.ts` プロンプト調整
  - 商品全般 OCR、各品目に `category_hint` 出力指示
- `supabase/functions/extract-receipt/validate.ts` zod スキーマ拡張
- 上記すべてに対するユニットテスト

**含まない**: 新画面追加、ダッシュボード、設定画面

**工数**: 2 日
**依存**: PR-2（新スキーマ前提）

---

### PR-4: Phase 4a — 既存画面の家計簿対応（履歴・詳細・新規登録 + CSV）

**ブランチ**: `feature/expense-screens`
**目的**: 「ログイン → レシート登録 → 履歴で確認」の最小エンドツーエンドが動く状態を作る。

**含む**:
- `web/components/expense/expense-form.tsx`（旧 shopping-form）
  - カテゴリを `expense_categories` ドロップダウンに
  - 各品目ごとにカテゴリ選択 UI
- `web/components/expense/receipt-uploader.tsx` 文言修正（買物 → 支出）
- `web/components/expense/new-expense-flow.tsx`（旧 new-shopping-flow）
  - OCR 後のフォーム流し込みに `category_hint` を反映
- `web/app/(app)/expense/page.tsx` 履歴一覧 文言・列調整
- `web/app/(app)/expense/[id]/page.tsx` 詳細表示
- `web/app/(app)/expense/[id]/edit/page.tsx` 編集
- `web/app/(app)/expense/new/page.tsx` 「レシートで」「手入力で」の入口
- `web/app/api/expense/export/route.ts`（旧 shopping/export）CSV ダウンロード
- 動作確認（PC + スマホで撮影 → 編集 → 保存 → 履歴 → CSV まで）

**含まない**: ダッシュボード、レポート、設定、固定費

**工数**: 1.5 日
**依存**: PR-3（ドメインロジック前提）

---

### PR-5: Phase 5 + Phase 4b — ダッシュボード + 固定費機能

**ブランチ**: `feature/dashboard-recurring`
**目的**: 「家計簿らしさ」の中核となるダッシュボードと、固定費自動計上を実装。

**含む**:
- `web/components/charts/CategoryPie.tsx` 新規（Recharts 円グラフラッパー）
- `web/components/charts/MonthlyBar.tsx` 新規（Recharts 棒グラフラッパー、PR-6 でも使う）
- `web/app/(app)/dashboard/page.tsx` 新規
  - 今月の合計
  - 今日までのペース（日割り平均 × 月日数）
  - カテゴリ別円グラフ（当月）
  - 未計上固定費アラート + 「N 件を登録」ボタン
- 固定費 Server Action（`web/lib/expense/recurring.ts` の `generatePending`）の UI 接続
- 動作確認（固定費未生成 → ダッシュボード表示 → ボタン → 履歴に反映）

**含まない**: 設定画面（固定費の CRUD UI は PR-6）、レポート画面

**工数**: 1.5 日
**依存**: PR-4（履歴画面が動くこと前提でフローテスト）

---

### PR-6: Phase 4c+4d — 設定画面 + レポート画面

**ブランチ**: `feature/settings-reports`
**目的**: 残りの主要画面（設定とレポート）を実装。

**含む**:
- `web/app/(app)/settings/page.tsx` 新規
  - プロフィール（表示名のみ。家計簿に身長等は不要）
  - カテゴリ管理（追加・編集・削除。標準カテゴリは編集のみ）
  - 固定費管理（追加・編集・停止/削除）
  - admin: ホワイトリスト管理（email 追加・削除・ロール変更）
- `web/app/(app)/reports/page.tsx` 新規
  - 月次推移棒グラフ（過去 6 / 12 ヶ月切替）
  - カテゴリ別円グラフ（月選択）
  - 前月比表示
  - CSV ダウンロード（PR-4 で実装した API を再利用）
- 動作確認（設定変更が反映される、レポートが正しく描画される）

**含まない**: ブランディング、デプロイ

**工数**: 1.5 日
**依存**: PR-5（チャートコンポーネント前提）

---

### PR-7: Phase 6 + Phase 7 — ブランディング + テスト整備 + デプロイ準備

**ブランチ**: `feature/branding-tests`
**目的**: リリース前の仕上げ。

**含む**:
- ブランディング:
  - `web/app/layout.tsx` の `<title>`, `<meta name="description">`, OG タグ
  - `web/public/manifest.webmanifest` のアプリ名・テーマカラー
  - `web/public/icons/` ファビコン・PWA アイコン（既存が OkazuLink 用なら差し替え）
- テスト:
  - 既存ユニットテストを通す（`pnpm test` グリーン）
  - 家計簿用に追加: `aggregations.test.ts`, `recurring.test.ts`
  - E2E（Playwright）3 本: ログイン→レシート登録、手入力 CRUD、固定費自動計上提案
  - モックレシート追加（ドラッグストア / コンビニ / 日用品店）
- Vercel プロジェクト作成 + 接続（依頼者と協力）
- 環境変数（Vercel + Supabase Edge Function secrets）設定
- デプロイ動作確認

**含まない**: 機能追加（バグ修正のみ）

**工数**: 1.5〜2 日
**依存**: PR-6（全画面が動くこと）

---

## 4. ガントチャート（目安）

```
日数  | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |10 |
PR-1  |███|                                           # 計画 + Phase 1
PR-2  |   |███|                                       # DB 再構築
PR-3  |   |   |███|███|                               # ドメインロジック
PR-4  |   |   |   |   |███|███/2|                     # 既存画面
PR-5  |   |   |   |   |   |███/2|███|                 # ダッシュボード + 固定費
PR-6  |   |   |   |   |   |   |   |███|███/2|         # 設定 + レポート
PR-7  |   |   |   |   |   |   |   |   |███/2|███|███/2|  # ブランディング + テスト + デプロイ
```

> **「███/2」は半日相当**を意味します（PR またぎの日）。

---

## 5. リスクと軽減策

| リスク | 影響 | 軽減策 |
|---|---|---|
| 新規 Supabase プロジェクト未作成のまま PR-2 に進む | DB 移行が試せない | PR-2 着手前に依頼者と合意してプロジェクト作成 |
| OCR の category_hint 精度が低い | ユーザーが毎回手動修正 | プロンプトを実レシートで複数回チューニング、最悪「その他」フォールバックでも実害は小さい |
| Recharts のレスポンシブ調整に時間が掛かる | 工数オーバー | デフォルトのまま使う、CSS 微調整は最低限 |
| E2E テスト（PR-7）が間に合わない | リリース後にデグレ検知が遅れる | ユニットテスト + 手動 golden path で代替し、E2E は MVP 後に追加可 |
| 急ぎ案件で要件変更が入る | スコープ膨張 | 設計書を根拠に Phase 2 以降に振り分ける判断を都度行う |

---

## 6. 完了の定義（DoD）

各 PR 共通:
- [ ] `pnpm typecheck` が通る
- [ ] `pnpm lint` が通る
- [ ] `pnpm test` が通る（追加・削除分も含めグリーン）
- [ ] PR description に「動作確認した内容」を記載
- [ ] UI を伴う PR は、スマホ + PC の両方で golden path を 1 回試す

MVP 全体:
- [ ] PR-1 〜 PR-7 すべてマージ
- [ ] Vercel 本番環境にデプロイ済み
- [ ] 依頼者の email がホワイトリスト登録済みでログイン可能
- [ ] 実物のレシート 1 枚で OCR → 保存 → 履歴 → 月次レポートまで動作

---

## 7. 関連ドキュメント

- [`requirements.md`](./requirements.md): 要件定義書
- [`design.md`](./design.md): 設計書
- [`adaptation-todo.md`](./adaptation-todo.md): 詳細タスク一覧（チェックリスト）
- [`receipt-scan-spec.md`](./receipt-scan-spec.md): 認証・OCR 共通仕様
