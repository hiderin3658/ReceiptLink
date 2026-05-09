# ReceiptLink

レシート写真を撮るだけで家計簿が完成するアプリ。

> **このリポジトリの状態**: OkazuLink プロジェクトから「認証 + レシートスキャン + OCR」部分のソースをコピーした初期状態です。家計簿アプリ用に再設計・改修する必要があります。

---

## プロジェクト由来

このプロジェクトは姉妹アプリ **[OkazuLink](../OkazuLink/)**（一人暮らし女性向け食生活コーチ）から、共通利用可能な以下の部分のコードをコピーして作成されました：

- Google OAuth + Supabase 認証
- レシート画像のアップロード（Supabase Storage）
- Gemini API によるレシート OCR（`extract-receipt` Edge Function）
- 商品リスト UI（編集・削除）

家計簿固有の機能（カテゴリ分類、月次集計、グラフ、予算管理など）は**未実装**です。

---

## ディレクトリ構成

```
ReceiptLink/
├── README.md                          # 本ファイル
├── docs/
│   ├── receipt-scan-spec.md           # ★ 共通利用部分の仕様書（NEW）
│   ├── adaptation-todo.md             # ★ 家計簿アプリ化のための作業 TODO（NEW）
│   ├── design.md.okazu-original.md    # OkazuLink の設計書（参考用）
│   ├── phase-1-2-test-plan.okazu-original.md
│   ├── phase-1-2-test-result.okazu-original.md
│   └── phase1-implementation-plan.okazu-original.md
├── supabase/
│   ├── config.toml                    # Supabase ローカル設定
│   ├── seed.sql
│   ├── functions/
│   │   ├── _shared/                   # 認証・OCR共通ライブラリ
│   │   │   ├── auth.ts                # JWT 検証
│   │   │   ├── cors.ts
│   │   │   ├── env.ts
│   │   │   ├── gemini.ts              # Gemini API クライアント
│   │   │   ├── ai-log.ts              # AI 呼び出しログ
│   │   │   ├── sanitize.ts
│   │   │   ├── hash.ts
│   │   │   └── types.ts
│   │   ├── extract-receipt/           # ★ レシート OCR エンドポイント
│   │   ├── hello/                     # 動作確認用
│   │   ├── deno.json
│   │   ├── import_map.json
│   │   ├── .env.sample
│   │   └── README.md.original
│   └── migrations/
│       ├── 20260421000001_phase0_schema.sql            # users / profiles 等
│       ├── 20260421000002_phase1_shopping_recipes.sql  # ★ 家計簿用に大幅改修必要
│       └── 20260421000004_storage_buckets.sql          # receipts バケット定義
└── web/
    ├── app/
    │   ├── (auth)/login/              # ログイン画面（Google OAuth）
    │   ├── (app)/
    │   │   ├── layout.tsx             # ナビ付きレイアウト
    │   │   └── shopping/              # ★ 買物履歴 → 「レシート履歴/家計簿」へ改名予定
    │   └── api/
    │       ├── auth/                  # OAuth コールバック / サインアウト
    │       └── shopping/export/       # CSV エクスポート
    ├── components/
    │   ├── layout/                    # 共通ナビ（要メニュー見直し）
    │   └── shopping/
    │       ├── receipt-uploader.tsx   # ★ レシート撮影 UI（再利用可）
    │       ├── new-shopping-flow.tsx  # 撮影 → OCR → 確認のフロー
    │       └── shopping-form.tsx      # 商品リスト編集
    ├── lib/
    │   ├── supabase/                  # Supabase クライアント（共通）
    │   └── shopping/                  # 買物 = レシートのドメインロジック
    │       ├── ocr.ts                 # extract-receipt 呼び出し
    │       ├── actions.ts             # Server Action
    │       ├── schema.ts              # zod スキーマ
    │       ├── csv.ts                 # CSV エクスポート
    │       └── ...
    ├── scripts/
    │   ├── tsconfig.json
    │   └── mock-receipts/             # ★ テスト用モックレシート生成
    │       ├── data.ts                # レシートデータ定義（マルハチ/ライフ/ダイクマ）
    │       ├── generate.ts            # PDF/PNG生成スクリプト
    │       ├── template.ts            # HTMLテンプレート
    │       ├── safe-slug.ts
    │       └── output/                # 生成済みレシート（PDF×10 + PNG×10）
    └── types/
        └── database.ts                # ★ レシピ系の型を削除し、家計簿型を追加必要
```

★ = 家計簿アプリ用に改修が必要

---

## まずやるべきこと

1. **`docs/receipt-scan-spec.md` を読む**（共通利用部分の仕様）
2. **`docs/adaptation-todo.md` を読む**（家計簿化に向けた具体的な作業リスト）
3. **新規 git リポジトリとして初期化**
   ```sh
   cd /Volumes/990PRO_SSD/personal/ReceiptLink
   git init
   git add .
   git commit -m "chore: OkazuLink から共通部分をコピーして初期化"
   ```
4. **`web/package.json` の `name` を `receipt-link-web` に変更**
5. **`.env` 系ファイルを再設定**（新しい Supabase プロジェクトを作成）
6. **マイグレーションを家計簿用に書き直す**

---

## 技術スタック（OkazuLink から継承）

- **フロントエンド**: Next.js 15 (App Router) + React 19 + TypeScript + Tailwind CSS v4
- **バックエンド**: Supabase（Postgres + Auth + Storage + Edge Functions）
- **AI**: Gemini 3 Flash / Pro（OCR 用、フォールバック付き）
- **テスト**: Vitest + Playwright
- **デプロイ想定**: Vercel + Supabase Cloud

---

## 注意事項

- OkazuLink から**コードをコピーした時点のスナップショット**です。OkazuLink 側で改修が入っても自動では同期されません。必要に応じて手動で取り込んでください。
- `web/.env.local` などのシークレットは含まれていません（`.env.example` のみコピー）。
