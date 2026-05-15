# ReceiptLink

レシート写真を撮るだけで家計簿が完成するアプリ。

Google ログインしてレシートを撮影 → Gemini が品目・金額・カテゴリを自動抽出 → そのまま支出として記録。月次の集計・カテゴリ別グラフ・固定費の自動計上にも対応した個人向け家計簿アプリです。

---

## 主な機能

- **Google OAuth ログイン**（許可リスト方式 / `allowed_users` テーブル）
- **レシート OCR**（Gemini 2.5 Flash / Pro フォールバック付き）
- **支出記録 / 編集 / CSV エクスポート**
- **月次ダッシュボード**（カテゴリ別円グラフ・月次推移バーチャート）
- **レポート画面**（期間集計・カテゴリ別レポート）
- **固定費の自動計上**（テンプレートからのワンクリック登録 + 未計上アラート）
- **カテゴリ管理 / プロフィール設定 / 許可ユーザー管理（admin のみ）**
- **Vercel Cron による Supabase Free Auto-pause 回避**（日次 keepalive ping）

---

## ドキュメント

| ファイル | 内容 |
|---|---|
| [`docs/requirements.md`](./docs/requirements.md) | 要件定義書（ターゲット・機能要件・制約） |
| [`docs/design.md`](./docs/design.md) | 設計書（DB スキーマ・画面・フロー・固定費自動計上） |
| [`docs/receipt-scan-spec.md`](./docs/receipt-scan-spec.md) | 認証・OCR・Storage の仕様 |
| [`docs/implementation-plan.md`](./docs/implementation-plan.md) | 実装計画 |
| [`docs/test-spec.md`](./docs/test-spec.md) | テスト仕様 |
| [`docs/adaptation-todo.md`](./docs/adaptation-todo.md) | 残 TODO |
| [`docs/case-d-tax-strategy.md`](./docs/case-d-tax-strategy.md) | 税区分の扱いに関するメモ |

---

## 技術スタック

- **フロントエンド**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **状態管理 / データ取得**: Zustand, TanStack Query
- **グラフ**: Recharts
- **バックエンド**: Supabase（Postgres + Auth + Storage + Edge Functions）
- **AI（OCR）**: Gemini 2.5 Flash / Pro
- **テスト**: Vitest（ユニット）+ Playwright（E2E）
- **デプロイ**: Vercel + Supabase Cloud
- **パッケージマネージャ**: pnpm

---

## ディレクトリ構成

```
ReceiptLink/
├── README.md                                # 本ファイル
├── docs/                                    # 要件・設計・仕様
├── supabase/
│   ├── config.toml                          # Supabase ローカル設定
│   ├── seed.sql                             # シードデータ（admin email など）
│   ├── functions/
│   │   ├── _shared/                         # 共通ライブラリ（auth/cors/env/gemini/sanitize/...）
│   │   ├── extract-receipt/                 # レシート OCR エンドポイント
│   │   └── hello/                           # 動作確認用
│   └── migrations/
│       ├── 20260509000001_initial_schema.sql      # 初期スキーマ（allowed_users, expense_*, recurring_*, ai_advice_logs 等）
│       └── 20260509000002_storage_buckets.sql     # receipts Storage バケット + RLS
└── web/
    ├── app/
    │   ├── (auth)/login/                    # ログイン画面（Google OAuth）
    │   ├── (app)/
    │   │   ├── layout.tsx                   # ナビ付きレイアウト
    │   │   ├── dashboard/                   # ダッシュボード（月次サマリ・グラフ）
    │   │   ├── expense/                     # 支出記録の一覧・追加・編集
    │   │   ├── reports/                     # 期間集計レポート
    │   │   ├── settings/                    # カテゴリ・固定費・プロフィール・許可ユーザー
    │   │   └── help/                        # 使い方ガイド
    │   └── api/
    │       ├── auth/                        # OAuth コールバック / サインアウト
    │       ├── cron/keepalive/              # Vercel Cron: Supabase Free Auto-pause 対策
    │       └── expense/                     # 支出 API（CSV エクスポートなど）
    ├── components/
    │   ├── layout/                          # 共通ナビ（side-nav, bottom-nav）
    │   ├── expense/                         # 支出フォーム・カメラ・OCR フロー
    │   ├── charts/                          # Recharts ラッパ（CategoryPie, MonthlyBar）
    │   └── settings/                        # 設定画面の各セクション
    ├── lib/
    │   ├── supabase/                        # Supabase クライアント（client / server）
    │   ├── auth/                            # 許可ユーザー・プロフィール server actions
    │   └── expense/                         # 支出・カテゴリ・固定費・集計・OCR ロジック
    ├── scripts/
    │   └── mock-receipts/                   # テスト用モックレシート生成
    ├── types/
    │   └── database.ts                      # Supabase 型定義
    └── e2e/                                 # Playwright E2E テスト
```

---

## セットアップ

### 前提

- Node.js 20 以上
- pnpm
- Docker（ローカル Supabase を起動する場合）
- Supabase CLI（`brew install supabase/tap/supabase` など）

---

### A. ローカル開発（Docker + Supabase CLI）

開発時は本番 Supabase Cloud を使わず、ローカル Supabase で動作確認できます。

```sh
# 1) 依存関係
cd web && pnpm install

# 2) ローカル Supabase 起動（要 Docker）
cd .. && supabase start
# → API URL: http://127.0.0.1:54321
#   Studio URL / anon key / service_role key が出力されるので控える

# 3) マイグレーション適用 + シード
supabase db reset

# 4) 環境変数（フロントエンド）
cp web/.env.example web/.env.local
# NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY を
# `supabase start` の出力値に置き換える

# 5) 環境変数（Edge Function）
cp supabase/functions/.env.sample supabase/functions/.env
# GEMINI_API_KEY を Google AI Studio で取得して設定（取得手順は下記参照）

# 6) Edge Function をローカルで起動（別タブ）
supabase functions serve --env-file ./supabase/functions/.env

# 7) Web アプリを起動
cd web && pnpm dev
```

開発用コマンド:

```sh
pnpm dev          # 開発サーバ
pnpm build        # 本番ビルド
pnpm typecheck    # TypeScript 型チェック
pnpm lint         # ESLint
pnpm test         # Vitest（ユニット）
pnpm test:e2e     # Playwright（E2E）
pnpm format       # Prettier フォーマット
```

---

### B. 本番環境（Vercel + Supabase Cloud）

#### B-1. Supabase Cloud のセットアップ

1. **新規プロジェクト作成**: https://supabase.com/dashboard
   - Region: `Northeast Asia (Tokyo)`
   - Pricing Plan: Free（MVP 期は十分）
   - プロジェクト作成後の `Project URL` と `anon` / `service_role` キーを控える

2. **マイグレーション適用**
   ```sh
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```

3. **Edge Function のデプロイ**
   ```sh
   # GEMINI_API_KEY を Supabase シークレットに登録
   supabase secrets set GEMINI_API_KEY=<your-key> --project-ref <project-ref>

   # 必要に応じてモデルも上書き
   supabase secrets set MODEL_OCR=gemini-2.5-flash --project-ref <project-ref>
   supabase secrets set MODEL_OCR_FALLBACK=gemini-2.5-pro --project-ref <project-ref>

   # Edge Function デプロイ
   supabase functions deploy extract-receipt --project-ref <project-ref>
   ```

4. **Google OAuth プロバイダ設定**（手順は「API キー取得」§ Google OAuth を参照）

5. **初期 admin ユーザー登録**
   - Web から 1 度 Google ログインを試みて `auth.users` にレコードを生成
   - Supabase SQL Editor で:
     ```sql
     insert into public.allowed_users (email, role, note)
     values ('<your-email@gmail.com>', 'admin', 'Owner');
     ```
   - 以降の許可ユーザー追加は `/settings` 画面（admin のみ）から可能

#### B-2. Vercel デプロイ

1. **プロジェクト作成**: https://vercel.com/new
   - GitHub リポジトリ `hiderin3658/ReceiptLink` をインポート
   - **Root Directory**: `web`（リポジトリ直下ではなく `/web` を指定）
   - Framework Preset: Next.js（自動検出）
   - Build / Output 設定はデフォルトのまま

2. **環境変数を設定**（Project Settings → Environment Variables）

   | 変数名 | 値 | 環境 |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` | All |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | All |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（秘密） | Production / Preview |
   | `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>.vercel.app` | Production |
   | `CRON_SECRET` | 任意の長いランダム文字列（例: `openssl rand -hex 32`） | Production |

3. **デプロイ実行 → 動作確認**
   - 本番 URL で Google ログイン → 許可リスト判定 → ダッシュボード表示

4. **Google OAuth に本番 URL を追加**
   - Google Cloud Console → OAuth クライアント ID
     - Authorized JavaScript origins に `https://<your-vercel-domain>.vercel.app` を追加
     - Authorized redirect URIs は Supabase 経由のため変更不要

5. **Vercel Cron の確認**
   - `web/vercel.json` で `/api/cron/keepalive` を JST 24:00（UTC 15:00）に日次実行するよう設定済み
   - Supabase Free プランの Auto-pause（7 日間アクセスなしで停止）を回避する目的
   - Vercel Cron が自動で `Authorization: Bearer $CRON_SECRET` ヘッダを付与するため、上記 `CRON_SECRET` の設定が必須

---

## API キー取得手順

### Gemini API キー（必須）

レシート OCR で使用します。

1. [Google AI Studio](https://aistudio.google.com/apikey) にアクセスし、Google アカウントでログイン
2. 「Create API key」をクリックして既存または新規 Google Cloud プロジェクトに紐づける
3. 発行されたキーをコピー
4. 設定先:
   - **ローカル**: `supabase/functions/.env` の `GEMINI_API_KEY=` に貼り付け
   - **本番**: `supabase secrets set GEMINI_API_KEY=<your-key> --project-ref <project-ref>`

> **注意**: `gemini-2.5-pro` は Free tier では利用不可（要 Billing 登録）。Free tier 運用なら `MODEL_OCR_FALLBACK` も flash 系（`gemini-2.5-flash` 等）に変更する。

### Google OAuth クライアント ID / Secret（必須）

Google ログインで使用します。

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. プロジェクトを作成（または既存のものを選択）
3. 左メニュー → 「API とサービス」→ 「OAuth 同意画面」
   - User Type: External
   - アプリ名・サポートメール・デベロッパー連絡先メールを入力
   - スコープ: `email`, `profile`, `openid`
   - テストユーザー（開発時のみ）に自分の Google アカウントを追加
4. 左メニュー → 「API とサービス」→ 「認証情報」→ 「認証情報を作成」→ 「OAuth クライアント ID」
   - アプリケーションの種類: ウェブアプリケーション
   - 承認済みの JavaScript 生成元（Authorized JavaScript origins）:
     - `http://localhost:3000`（ローカル開発用）
     - `https://<your-vercel-domain>.vercel.app`（本番用）
   - 承認済みのリダイレクト URI（Authorized redirect URIs）:
     - `https://<project-ref>.supabase.co/auth/v1/callback`（Supabase の OAuth コールバック固定）
5. 発行された `Client ID` と `Client Secret` をコピー
6. Supabase Dashboard → Authentication → Providers → Google で `Client ID` / `Client Secret` を登録して有効化

### CRON_SECRET（本番のみ）

Vercel Cron の認証用シークレットです。値は任意の長いランダム文字列。

```sh
# 生成例（macOS / Linux）
openssl rand -hex 32
```

生成した値を Vercel の環境変数 `CRON_SECRET` に設定するだけ。Vercel Cron は本番環境で自動的に `Authorization: Bearer $CRON_SECRET` ヘッダを付与してくれます。

---

## 環境変数一覧

### `web/.env.local`（フロントエンド / Vercel）

| 変数 | 用途 | 必須 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | ◯ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key | ◯ |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key（admin 操作・cron で使用） | ◯ |
| `NEXT_PUBLIC_APP_URL` | アプリの公開 URL（OAuth リダイレクト先など） | ◯ |
| `CRON_SECRET` | Vercel Cron の認証用シークレット | 本番のみ |

### `supabase/functions/.env`（Edge Function / Supabase Secrets）

| 変数 | 用途 | デフォルト |
|---|---|---|
| `GEMINI_API_KEY` | Gemini API キー | 必須 |
| `MODEL_OCR` | OCR メインモデル | `gemini-2.5-flash` |
| `MODEL_OCR_FALLBACK` | OCR フォールバックモデル | `gemini-2.5-pro`（Free tier 不可） |

> `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` は `supabase functions serve` 起動時に自動注入されるため、`.env` には記載不要。

---

## 運用メモ

- **許可ユーザー方式**: Google ログインしただけでは利用不可。`allowed_users` テーブルに事前登録された email のみログイン可能（admin は `/settings` から追加可能）
- **アプリ内ブラウザ対策**: LINE / Facebook / Instagram / X / Android WebView などの埋め込みブラウザは Google のポリシーで OAuth がブロックされるため、ログイン画面で検出して警告表示
- **Supabase Free Auto-pause 回避**: Vercel Cron が `/api/cron/keepalive` を日次で叩き、軽量 SELECT を発生させることで Auto-pause を防止
- **シークレット類**: `web/.env.local`, `supabase/functions/.env` は `.gitignore` 済み

---

## ライセンス

個人プロジェクト。
