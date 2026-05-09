# レシートスキャン共通仕様書

> OkazuLink から ReceiptLink へ引き継ぐ「認証 + レシート撮影 + OCR」部分の仕様。
> 出典: OkazuLink `docs/design.md` の関連箇所を抽出・整理したもの。

---

## 1. 認証フロー

### 1.1 認証方式
- **Google OAuth 2.0**（Supabase Auth 経由）
- 他の認証手段（メール/パスワード、マジックリンク等）は現時点で未対応

### 1.2 ログイン画面
- ファイル: `web/app/(auth)/login/page.tsx`
- 「Google でログイン」ボタンのみのシンプルな画面
- 未ログイン状態でアプリ画面にアクセスすると `/login` へリダイレクト

### 1.3 OAuth コールバック
- ファイル: `web/app/api/auth/callback/route.ts`
- Google からのリダイレクトを受け、Supabase セッションを発行
- 成功時は `/` へリダイレクト

### 1.4 サインアウト
- ファイル: `web/app/api/auth/signout/route.ts`

### 1.5 サーバーサイドのセッション取得
- ファイル: `web/lib/supabase/server.ts`
- Server Component / Route Handler / Server Action から `createClient()` で取得
- Cookie ベースの SSR セッション

### 1.6 クライアントサイドのセッション取得
- ファイル: `web/lib/supabase/client.ts`
- Client Component から `createBrowserClient` 経由で利用

### 1.7 アクセス制御（重要）
- middleware は **使用しない**（Edge Runtime での問題を回避するため）
- 各 Server Component / Route Handler の冒頭で `supabase.auth.getUser()` を呼んでガード
- Row Level Security (RLS) で DB 側もユーザー単位にアクセス制限

> 注: OkazuLink で `allowed_users` テーブルによるホワイトリスト制を採用している場合、ReceiptLink では撤廃して通常のユーザー登録に切り替えることを推奨。

---

## 2. レシート画像のアップロード

### 2.1 ストレージ構成
- バケット名: `receipts`（プライベート）
- パス命名規則: `receipts/{user_id}/{uuid}.{ext}`
- ファイルサイズ上限: **10MB**
- 許可 MIME: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- マイグレーション: `supabase/migrations/20260421000004_storage_buckets.sql`

### 2.2 アクセス制御（RLS）
- 所有者のみ read / write / delete 可能
- 閲覧時は **署名付き URL** を発行（直接公開しない）

### 2.3 アップロード UI
- ファイル: `web/components/shopping/receipt-uploader.tsx`
- ドラッグ&ドロップ + ファイル選択 + カメラ撮影に対応
- スマホでは `<input type="file" capture="environment">` でカメラ起動
- アップロード後、後述の `extract-receipt` Edge Function を呼んで OCR

### 2.4 撮影 → OCR → 編集のフロー
- エントリー: `web/app/(app)/shopping/new/page.tsx`
- フロー制御: `web/components/shopping/new-shopping-flow.tsx`
  1. レシート画像をアップロード
  2. `extract-receipt` を呼んで JSON 抽出
  3. 抽出結果を `shopping-form.tsx` で編集
  4. Server Action（`web/lib/shopping/actions.ts`）で DB 保存

---

## 3. レシート OCR（Gemini API）

### 3.1 Edge Function
- ファイル: `supabase/functions/extract-receipt/index.ts`
- 入力: `{ image_path: string }`（Storage 内のパス）
- 出力: 構造化された商品リスト JSON

### 3.2 使用モデル
| 用途 | モデル | 環境変数 |
|------|--------|---------|
| 通常 | Gemini 3 Flash | `MODEL_OCR` |
| フォールバック（Flash 失敗時） | Gemini 3 Pro | `MODEL_OCR_FALLBACK` |

- Flash で十分な精度・速度・コスト
- かすれ・曲がり等で Flash がパース失敗した場合に Pro で自動リトライ

### 3.3 抽出する情報
- 店舗名
- 購入日時
- 品目リスト（品名・数量・単価・合計金額）
- 小計 / 値引き（クーポン等）
- 合計金額

### 3.4 抽出 JSON スキーマ（例）
```json
{
  "store_name": "イオン○○店",
  "purchased_at": "2026-04-21T18:32:00",
  "items": [
    { "name": "豚こま切れ", "quantity": 1, "unit": "パック", "unit_price": 398, "total_price": 398, "discount": 0 },
    { "name": "キャベツ", "quantity": 1, "unit": "個", "unit_price": 198, "total_price": 198, "discount": 0 }
  ],
  "subtotal": 596,
  "discount": 0,
  "total_amount": 596
}
```
- バリデーション: `supabase/functions/extract-receipt/validate.ts`（zod）

### 3.5 Gemini クライアント
- ファイル: `supabase/functions/_shared/gemini.ts`
- Vertex AI ではなく **Google AI Studio API** を直接呼ぶ実装
- 必要環境変数: `GEMINI_API_KEY`

### 3.6 AI 呼び出しログ
- ファイル: `supabase/functions/_shared/ai-log.ts`
- DB テーブル `ai_advice_logs` に input_hash / model / token 数 / レイテンシを記録
- コスト分析・キャッシュ判定に使用

### 3.7 エラー処理
- Flash 失敗 → Pro リトライ
- Pro も失敗 → ユーザーに「読み取り失敗。手入力に切り替えてください」を表示
- すべてのエラーはログテーブルに記録

---

## 4. 環境変数

### 4.1 Web (`web/.env.local`)
```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # サーバー側のみ
```

### 4.2 Edge Functions (`supabase/functions/.env`)
```env
GEMINI_API_KEY=...
MODEL_OCR=gemini-3.0-flash
MODEL_OCR_FALLBACK=gemini-3.0-pro
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

詳細は `supabase/functions/.env.sample` 参照。

---

## 5. データベース（共通利用部分のみ）

### 5.1 認証関連（Supabase 標準）
- `auth.users` （Supabase が管理）

### 5.2 ユーザープロフィール（必要に応じて）
- OkazuLink では `user_profiles` に身長・目標体重等を保持していたが、家計簿アプリでは別の項目（世帯人数・予算等）を持つ別テーブルを設計すべき

### 5.3 レシートスキャン関連（家計簿用に再設計推奨）

OkazuLink では以下の構造（料理目線）：
- `shopping_records` （買物単位）
  - `id`, `user_id`, `purchased_at`, `store_name`, `total_amount`, `image_paths`, `source_type` (`receipt` | `manual`)
- `shopping_items` （明細）
  - `shopping_record_id`, `food_id`, `raw_name`, `category` (food_category enum), `quantity`, `unit_price`, `total_price`

家計簿用に変える際の検討事項：
- `food_id` / `food_category` は不要 → 家計簿用カテゴリ（食費 / 日用品 / 嗜好品 等）に置換
- 月次予算管理用テーブル `monthly_budgets` を追加
- 店舗カテゴリ（コンビニ / スーパー / ドラッグストア 等）の追加

### 5.4 AI ログ（共通利用可）
- `ai_advice_logs`: AI 呼び出しの監査ログ（OCR 含む）

---

## 6. 主要ファイル早見表

### バックエンド（共通利用可）
| ファイル | 役割 |
|---------|------|
| `supabase/functions/extract-receipt/index.ts` | レシート OCR エンドポイント |
| `supabase/functions/extract-receipt/validate.ts` | OCR 結果のバリデーション |
| `supabase/functions/_shared/gemini.ts` | Gemini API クライアント |
| `supabase/functions/_shared/auth.ts` | JWT 検証ユーティリティ |
| `supabase/functions/_shared/ai-log.ts` | AI 呼び出しログ記録 |

### フロントエンド（共通利用可）
| ファイル | 役割 |
|---------|------|
| `web/app/(auth)/login/page.tsx` | Google OAuth ログイン画面 |
| `web/app/api/auth/callback/route.ts` | OAuth コールバック |
| `web/lib/supabase/server.ts` | サーバー用 Supabase クライアント |
| `web/lib/supabase/client.ts` | ブラウザ用 Supabase クライアント |
| `web/components/shopping/receipt-uploader.tsx` | 撮影 / アップロード UI |
| `web/lib/shopping/ocr.ts` | extract-receipt 呼び出し |

### フロントエンド（家計簿用に書き直し必要）
| ファイル | 改修方針 |
|---------|---------|
| `web/components/shopping/shopping-form.tsx` | 食材カテゴリ → 家計簿カテゴリへ |
| `web/lib/shopping/schema.ts` | zod スキーマを家計簿項目に変更 |
| `web/lib/shopping/actions.ts` | Server Action のフィールドを変更 |
| `web/types/database.ts` | レシピ関連の型を全削除、家計簿型を追加 |

---

## 7. テスト

### 7.1 ユニットテスト（Vitest）
- 各 `*.test.ts` ファイルが既存
- `supabase/functions/extract-receipt/validate.test.ts` は OCR 出力検証のテスト
- `web/lib/shopping/ocr.test.ts` は OCR 呼び出しのモックテスト

### 7.2 E2E テスト（Playwright）
- OkazuLink の E2E は持ち込んでいないため、ReceiptLink 用に新規作成

---

## 8. 参考資料

- OkazuLink 設計書全文: `docs/design.md.okazu-original.md`
- OkazuLink Phase 1 実装計画: `docs/phase1-implementation-plan.okazu-original.md`
- OkazuLink テスト計画: `docs/phase-1-2-test-plan.okazu-original.md`
