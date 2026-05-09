# ReceiptLink

レシート写真を撮るだけで家計簿が完成するアプリ。

> **このリポジトリの状態**: OkazuLink プロジェクトから「認証 + レシートスキャン + OCR」部分のソースをコピーした初期状態 + 要件定義・設計書整備済み。これから家計簿アプリ用に再設計・改修するフェーズに入ります。

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`docs/requirements.md`](./docs/requirements.md) | 要件定義書（ターゲット・機能要件・制約） |
| [`docs/design.md`](./docs/design.md) | 設計書（DB スキーマ・画面・フロー・固定費自動計上） |
| [`docs/receipt-scan-spec.md`](./docs/receipt-scan-spec.md) | 認証・OCR・Storage の共通仕様（OkazuLink から継承） |
| [`docs/adaptation-todo.md`](./docs/adaptation-todo.md) | 実装 TODO リスト（Phase 0 〜 Phase 7） |
| [`docs/legacy/`](./docs/legacy/) | OkazuLink 由来の参考ドキュメント |

---

## プロジェクト由来

このプロジェクトは姉妹アプリ **OkazuLink**（一人暮らし女性向け食生活コーチ）から、共通利用可能な以下の部分のコードをコピーして作成されました：

- Google OAuth + Supabase 認証
- レシート画像のアップロード（Supabase Storage）
- Gemini API によるレシート OCR（`extract-receipt` Edge Function）
- 商品リスト UI（編集・削除）

家計簿固有の機能（カテゴリ管理、月次集計、グラフ、固定費自動計上など）は **これから実装** します。

---

## ディレクトリ構成

```
ReceiptLink/
├── README.md                          # 本ファイル
├── docs/
│   ├── requirements.md                # ★ 要件定義書
│   ├── design.md                      # ★ 設計書
│   ├── receipt-scan-spec.md           # 共通利用部分の仕様
│   ├── adaptation-todo.md             # 実装 TODO
│   └── legacy/                        # OkazuLink 由来の参考ドキュメント
├── supabase/
│   ├── config.toml                    # Supabase ローカル設定
│   ├── seed.sql
│   ├── functions/
│   │   ├── _shared/                   # 認証・OCR共通ライブラリ
│   │   │   ├── auth.ts
│   │   │   ├── cors.ts
│   │   │   ├── env.ts
│   │   │   ├── gemini.ts
│   │   │   ├── ai-log.ts
│   │   │   ├── sanitize.ts
│   │   │   ├── hash.ts
│   │   │   └── types.ts
│   │   ├── extract-receipt/           # レシート OCR エンドポイント
│   │   ├── hello/                     # 動作確認用
│   │   └── ...
│   └── migrations/
│       ├── 20260421000001_phase0_schema.sql            # ※ Phase 2 で破棄予定
│       ├── 20260421000002_phase1_shopping_recipes.sql  # ※ Phase 2 で破棄予定
│       └── 20260421000004_storage_buckets.sql          # ※ Phase 2 で破棄予定
└── web/
    ├── app/
    │   ├── (auth)/login/              # ログイン画面（Google OAuth）
    │   ├── (app)/
    │   │   ├── layout.tsx             # ナビ付きレイアウト
    │   │   └── shopping/              # ★ Phase 3 で expense/ にリネーム予定
    │   └── api/
    │       ├── auth/                  # OAuth コールバック / サインアウト
    │       └── shopping/export/       # ★ Phase 3 で expense/ にリネーム予定
    ├── components/
    │   ├── layout/                    # 共通ナビ
    │   └── shopping/                  # ★ Phase 3 で expense/ にリネーム予定
    ├── lib/
    │   ├── supabase/                  # Supabase クライアント（共通）
    │   └── shopping/                  # ★ Phase 3 で expense/ にリネーム予定
    ├── scripts/
    │   └── mock-receipts/             # テスト用モックレシート生成
    └── types/
        └── database.ts                # ★ Phase 1 でレシピ系型を削除予定
```

---

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **グラフ**: Recharts（**新規追加予定**）
- **バックエンド**: Supabase（Postgres + Auth + Storage + Edge Functions）
- **AI**: Gemini 3 Flash / Pro（OCR 用、フォールバック付き）
- **テスト**: Vitest + Playwright
- **デプロイ**: Vercel + Supabase Cloud

---

## セットアップ

具体的な手順は [`docs/adaptation-todo.md` の Phase 0](./docs/adaptation-todo.md) を参照。

### A. ローカル開発（Docker + Supabase CLI）— 推奨

開発初期は本番 Supabase Cloud プロジェクトを作らず、ローカル Supabase で動作確認します。

```sh
# 1) 依存関係
cd web && pnpm install

# 2) ローカル Supabase 起動（要 Docker）
cd .. && supabase start
# → API URL: http://127.0.0.1:54321
#   anon key と service_role key は出力されるので控える

# 3) マイグレーション適用 + シード
supabase db reset

# 4) 環境変数
cp web/.env.example web/.env.local
# NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY を
# supabase start で表示された値に書き換える
cp supabase/functions/.env.sample supabase/functions/.env
# GEMINI_API_KEY を Google AI Studio で取得して設定

# 5) Web 起動
cd web && pnpm dev
```

### B. 本番環境（Vercel + Supabase Cloud）— PR-7 で実施

1. 新規 Supabase プロジェクト作成（無料枠 / Tokyo）
2. Supabase に Google OAuth プロバイダ設定
3. `supabase db push` でマイグレーション適用
4. Vercel に環境変数を設定してデプロイ

---

## 開発の進め方

要件 → 設計 は確定済み。今後は以下の順で進めます:

| Phase | 内容 |
|---|---|
| Phase 1 | 不要コード削除（OkazuLink 由来のレシピ・栄養関連） |
| Phase 2 | DB マイグレーション統合・書き直し |
| Phase 3 | ドメインロジック書き換え（`shopping/` → `expense/`） |
| Phase 4 | UI 改修（ナビ / フォーム / ダッシュボード新規） |
| Phase 5 | 固定費機能 + レポート機能 |
| Phase 6 | ブランディング + Vercel デプロイ |
| Phase 7 | テスト + バグ修正 |

詳細は [`docs/adaptation-todo.md`](./docs/adaptation-todo.md) と [`docs/design.md`](./docs/design.md) を参照。

---

## 注意事項

- OkazuLink から **コードをコピーした時点のスナップショット** です。OkazuLink 側で改修が入っても自動では同期されません。
- `web/.env.local` などのシークレットは含まれていません（`.env.example` のみ）。
