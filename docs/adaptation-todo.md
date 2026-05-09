# ReceiptLink 化 TODO リスト

OkazuLink からコピーしたコードベースを家計簿アプリ「ReceiptLink」に書き換えるための作業リスト。

優先度: 🔴 必須 / 🟡 推奨 / 🟢 任意

---

## Phase 0: プロジェクトセットアップ

- [ ] 🔴 git リポジトリ初期化（`git init`）
- [ ] 🔴 GitHub リポジトリ作成（`hiderin3658/ReceiptLink`）
- [ ] 🔴 `web/package.json` の `name` を `okazu-link-web` → `receipt-link-web` に変更
- [ ] 🔴 `web/package.json` の不要スクリプト削除（`seed:foods`, `backfill:food-ids`）
  - `gen:receipts` は**残す**（モックレシート生成に使用、家計簿アプリでもテストデータとして活用）
- [ ] 🔴 新規 Supabase プロジェクト作成（無料枠 / Tokyo リージョン）
- [ ] 🔴 `web/.env.local` を作成し新 Supabase の URL / anon key を設定
- [ ] 🔴 Supabase に Google OAuth プロバイダ設定（Google Cloud Console で OAuth クライアント発行）
- [ ] 🔴 `supabase/functions/.env` を作成し Gemini API キーを設定
- [ ] 🔴 `pnpm install` で依存関係インストール

---

## Phase 1: 不要コード削除

OkazuLink 由来で家計簿アプリに不要な部分を削除。

- [ ] 🔴 `web/types/database.ts` からレシピ関連型を削除
  - 削除: `Recipe`, `RecipeIngredient`, `SavedRecipe`, `RakutenRecipeCache`, `Cuisine`, `RecipeSource`, `ExternalRecipeProvider`, `RecipeSourcePreference`, `Food`, `FoodCategory`, `GoalType`
- [ ] 🔴 ナビゲーションから不要メニュー削除
  - `web/components/layout/bottom-nav.tsx`
  - `web/components/layout/side-nav.tsx`
  - 削除候補: 「レシピ」「献立」「栄養」「体重」「運動」
  - 残す: 「ホーム / ダッシュボード」「レシート登録」「履歴」「設定」
- [ ] 🟡 `web/lib/shopping/attach-food-ids.ts` 削除（食材マスタ紐付けは不要）
- [ ] 🟡 `web/lib/shopping/aggregations.ts` を家計簿用に書き直し（食材ベース → 月次予算ベース）

---

## Phase 2: データモデル再設計

家計簿用に DB スキーマを書き直す。

- [ ] 🔴 `supabase/migrations/20260421000002_phase1_shopping_recipes.sql` を**全面書き換え**
  - レシピ・食材マスタ系テーブルをすべて削除
  - 家計簿用テーブルを定義:
    - `expense_records`（旧 shopping_records 相当）
    - `expense_items`（旧 shopping_items 相当 / `food_id` 削除、`category` を家計簿用に）
    - `expense_categories`（食費 / 日用品 / 嗜好品 / 衣服 / 美容 / その他 等）
    - `monthly_budgets`（ユーザーごとの月次予算）
- [ ] 🔴 `user_profiles` を家計簿向けに再定義
  - 削除: `goal_type`, `height_cm`, `target_weight_kg`, `allergies`, `disliked_foods`
  - 追加: `household_size`（世帯人数）, `monthly_budget_default`（既定月次予算）
- [ ] 🔴 マイグレーションファイル名を新しい日付に変更（例: `20260509000001_initial_schema.sql`）
- [ ] 🔴 既存マイグレーションを統合して 1 ファイルに整理（履歴を持ち込まない）

---

## Phase 3: ドメインロジック書き換え

- [ ] 🔴 `web/lib/shopping/` フォルダ名を `web/lib/expense/` にリネーム
- [ ] 🔴 `web/lib/expense/schema.ts`（旧 `lib/shopping/schema.ts`）
  - `food_id` 削除
  - `category` を家計簿用 enum に
  - 必要に応じて `payment_method`（現金/クレカ/電子マネー）を追加
- [ ] 🔴 `web/lib/expense/actions.ts`
  - INSERT 時のテーブル名を `expense_records` に
  - 月次予算超過チェックロジックを追加
- [ ] 🔴 `web/lib/expense/aggregations.ts`
  - カテゴリ別集計
  - 月次合計
  - 前月比
- [ ] 🟡 `web/lib/expense/csv.ts`
  - 出力カラムを家計簿向けに変更（マネーフォワードや Zaim の CSV 形式と互換性を持たせると良い）

### Edge Function 側
- [ ] 🟡 `supabase/functions/extract-receipt/index.ts` のプロンプト調整
  - 「食材抽出」目線 → 「商品全般 + 店舗カテゴリ判定」目線へ
  - クーポン・ポイント値引きの分離抽出
  - 軽減税率の判定（任意）
- [ ] 🟡 `extract-receipt/validate.ts` の zod スキーマを家計簿用に拡張

---

## Phase 4: UI 改修

- [ ] 🔴 `web/components/shopping/` を `web/components/expense/` にリネーム
- [ ] 🔴 `expense/receipt-uploader.tsx`
  - 文言を「買物」→「支出登録」に
  - そのまま再利用可能
- [ ] 🔴 `expense/expense-form.tsx`（旧 shopping-form.tsx）
  - 食材カテゴリ選択 UI を家計簿カテゴリ選択に
  - 支払い方法フィールドを追加
- [ ] 🔴 `web/app/(app)/shopping/` を `web/app/(app)/expense/` にリネーム
  - URL も `/expense` 系に
- [ ] 🟡 ダッシュボード `web/app/(app)/dashboard/page.tsx` を新規作成
  - 今月の支出合計
  - カテゴリ別円グラフ
  - 予算消化バー

---

## Phase 5: 新規機能

家計簿アプリならではの機能。

- [ ] 🟡 月次予算設定画面
- [ ] 🟡 カテゴリ別月次レポート
- [ ] 🟢 予算超過時の通知（メール / プッシュ）
- [ ] 🟢 グラフ表示（recharts 等の追加が必要）
- [ ] 🟢 マネーフォワード / Zaim への CSV 連携
- [ ] 🟢 固定費の自動計上（家賃・光熱費）
- [ ] 🟢 レシートではなく「銀行明細・クレカ明細」からの取込（将来）

---

## Phase 6: ブランディング・デプロイ

- [ ] 🔴 アプリ名・タイトル・メタ情報を ReceiptLink に変更
  - `web/app/layout.tsx`
  - `web/public/manifest.webmanifest`
- [ ] 🟡 ロゴ・ファビコン作成
- [ ] 🟡 `web/public/icons/` のアイコン差し替え
- [ ] 🟡 OG 画像作成
- [ ] 🟡 Vercel プロジェクト作成・接続
- [ ] 🟡 ドメイン取得（`receiptlink.app` 等）

---

## Phase 7: テスト

- [ ] 🔴 既存ユニットテストを通す（`pnpm test`）
- [ ] 🟡 家計簿固有ロジックのユニットテスト追加
- [ ] 🟡 E2E テスト（Playwright）を新規作成
  - ログイン → レシート撮影 → OCR → 編集 → 保存 → 履歴表示
- [ ] 🟡 モックレシート（`web/scripts/mock-receipts/output/*.pdf`）で OCR 精度を検証
  - 既存10種類: マルハチ / ライフ / ダイクマ（食品系のため、家計簿用に「ドラッグストア」「コンビニ」「日用品店」のレシートを追加生成すると良い）
  - 生成方法: `pnpm gen:receipts`（`web/scripts/mock-receipts/data.ts` にデータ追加 → 実行）

---

## メモ

- **OkazuLink の改善が ReceiptLink にも適用したい場合**は、対応コミットを手動で `cherry-pick` または差分を見て手動反映する
- 逆に ReceiptLink で改善した OCR ロジック等を OkazuLink に戻す場合も同様
- 半年〜1年後、両アプリで「明らかに同じ」コードが残っていれば、共通モジュール（npm private package or モノレポ）化を検討
