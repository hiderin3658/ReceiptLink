# 案 B: OCR 抽出時の税込価格 / 軽減税率 (8% / 10%) 自動判定 — 設計メモ

> **ステータス**: 後続実装の予定 (2026-05-10 時点で着手前)
> **保留理由**: Android カメラ撮影時のメモリ不足問題 (案 D `getUserMedia`) を先に対応する必要があるため。本ドキュメントは設計の継続性を保つための備忘録。

---

## 1. 背景と目的

### 1.1 現状の課題
ReceiptLink の Gemini OCR (`extract-receipt`) は各品目の `total_price` を「値引き前の小計」としてのみ抽出している。レシート上の表記 (税抜 / 税込) や軽減税率 (8% / 10%) は判定していないため、以下の問題がある:

- **税抜表示のレシートを取り込むと**、各品目の税抜合計と「合計金額 (税込)」がズレる
- 一覧表示・編集画面・カテゴリ別集計のすべてで「品目を足しても合計と合わない」現象
- ユーザーから「家計簿としては実際に支払った税込で記録したい」要望

### 1.2 ゴール
- 各品目を **税込価格** で `total_price` に記録する
- レシートが税抜表示なら自動換算 (8% or 10% のどちらかを判定)
- レシートが税込表示ならそのまま採用

---

## 2. 前提となる事実 (調査済み)

### 2.1 インボイス制度後のレシートに記載されている情報
2023 年 10 月以降、適格簡易請求書 (= 一般のスーパー・コンビニ等が発行するレシート) には法的に以下が必須:

| 記載事項 | 例 |
|---|---|
| 税率ごとに区分した合計金額 | `8%対象 1,200円 / 10%対象 800円` |
| 税率ごとの消費税額 or 適用税率 | `内消費税 96円(8%) 80円(10%)` |
| 軽減税率対象品目への記号 | `※`, `*`, `★` 等 + 凡例 (例: 「※は軽減税率(8%)対象」) |

→ 判定に必要な情報は **国の制度として保証** された状態でレシート上に存在する。

### 2.2 Gemini Vision の能力
- ※マーク等の記号認識 → 得意分野
- 「税抜」「税込」「内税」「外税」キーワード認識 → 問題なし
- 「8%対象 / 10%対象」の集計行構造化 → 対応可能

### 2.3 主要家計簿アプリの現状
- Zaim / マネーフォワード ME (個人向け) は **税率自動判定機能なし** (税込合計のみ記録)
- ReceiptLink で実装すれば差別化要素

---

## 3. 実装方針: 案 B (Gemini に税込換算を任せる)

### 3.1 基本コンセプト
プロンプトで Gemini に **「各品目の `total_price` は必ず税込価格で返してください」** と明示。レシートの表示形式に応じて Gemini 自身に判定・換算させる。

### 3.2 プロンプト改修箇所
`supabase/functions/_shared/prompts.ts` の `buildReceiptOcrPrompt`:

```diff
  抽出対象:
  - 商品リスト (items): 各品目について
    - raw_name: 商品名そのまま
    - quantity: 数量（無ければ null）
    - unit: 単位（個 / g / パック など、無ければ null）
-   - total_price: 値引き前の小計（円、整数）
+   - total_price: 値引き前の小計 (税込価格、円、整数)
+   - tax_rate: 8 (軽減税率) or 10 (標準税率)。判別不能なら 10
    - category_hint: 以下のカテゴリ名から最も近いもの 1 つ → ${categoriesList}

  重要なルール:
+ - 各品目の total_price は必ず税込価格で返すこと:
+   - レシートが税込表示 (内税 / ※マークと凡例で税込明示) → そのまま採用
+   - レシートが税抜表示 (外税 / 「税抜」表記) → 適用税率で計算して税込換算
+     例: 税抜 100 円で税率 10% → 110 円
+   - 軽減税率対象品目 (食品 / 飲料 / 新聞等、※や*マークで明示されることが多い)
+     は tax_rate=8、それ以外は tax_rate=10 を返す
```

### 3.3 型定義の改修
`web/lib/expense/ocr.ts`:
```ts
export interface OcrItem {
  raw_name: string;
  quantity: number | null;
  unit: string | null;
  total_price: number;       // ← 仕様変更: 必ず税込価格
  tax_rate: 8 | 10;          // ← 新規
  category_hint: string | null;
}
```

`supabase/functions/extract-receipt/validate.ts` も同期: `tax_rate` を 8 or 10 に丸めるバリデーション追加。

### 3.4 既存データとの互換性
- DB スキーマ (`expense_items.total_price`) は **数値カラムのまま温存** (税込か税抜かをカラムで持たない)
- `tax_rate` は新規カラム追加 or `expense_items.note` に保存する選択肢あり
- → DB マイグレーションを伴うか、UI のみで持つかは別途判断

### 3.5 検算と警告 UI
- 各品目の税込 `total_price` 合計と Gemini が返す `total_amount` (=値引き後支払額) を比較
- ズレが ±5 円超なら UI に「※OCR 結果の合計に誤差があります。確認してください」を表示

---

## 4. 案 A / 案 C との比較 (再掲)

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A. 比例配分 | Gemini に「8%対象合計」「10%対象合計」だけ抽出 → 各品目を比例配分で換算 | 実装小 | 品目単位の精度低下 |
| **B. Gemini 任せ** ⭐ | プロンプトで「税込で返せ」を明示 + tax_rate 追加 | 実装中 / 既存スキーマ流用可 | プロンプト精度依存 |
| C. 構造化フル取得 | 各品目に `is_tax_included` `tax_rate` `tax_included_price` を全部 Gemini に返させ、クライアント計算 | 最も堅牢 / 検算可能 | 実装大 / DB スキーマ変更 |

→ **B → C の段階的拡張** が現実的:
1. まず案 B で運用開始
2. 端数誤差が大きい / 税率分析機能が欲しいケースが出てきたら案 C に拡張

---

## 5. 制約・想定リスク

| 制約 | 内容 | 対策 |
|---|---|---|
| インボイス制度前のレシート (2023.10 以前) | 税率情報が不完全 | 「判別不能なら 10%」のフォールバック |
| 小規模個人店舗 | インボイス未登録で税率記載なし | 同上 |
| 手書きレシート | 誤認の可能性 | UI で編集可能 (既存通り) |
| 端数誤差 | 比例配分でも 1〜2 円のズレが出る | 検算 UI で警告表示 |
| 既存登録データ | 税抜のままで残っている | UI では新規データのみ税込前提とし、過去データは触らない (暗黙) |

---

## 6. 着手時の手順 (チェックリスト)

- [ ] 新規ブランチ `feat/ocr-tax-classification` 作成 (main 起点)
- [ ] `supabase/functions/_shared/prompts.ts` のプロンプト改修
- [ ] `supabase/functions/extract-receipt/validate.ts` に tax_rate バリデーション追加
- [ ] `web/lib/expense/ocr.ts` の `OcrItem` 型に `tax_rate` 追加 (オプショナルでも可)
- [ ] `web/lib/expense/ocr.ts` の `ocrToExpenseInput` で `tax_rate` を `expense_items.note` 等に転記 (DB 側で保持しないなら不要)
- [ ] vitest で正規化ロジックのユニットテスト追加
- [ ] Edge Function 再デプロイ (`supabase functions deploy extract-receipt --project-ref zqobhmhcimwqnwmwjrgt`)
- [ ] テスト用レシート (内税表示・外税表示・軽減税率混在) で実機確認
- [ ] PR 作成

---

## 7. 関連リンク

- 国税庁: [適格請求書の記載事項 (PDF)](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/01-09.pdf)
- 国税庁: [適格簡易請求書の記載事項 (PDF)](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/qa/58.pdf)
- 国税庁: [インボイス制度の理解のために (令和8年4月版 PDF)](https://www.nta.go.jp/taxes/shiraberu/zeimokubetsu/shohi/keigenzeiritsu/pdf/0020006-027.pdf)

---

## 8. 履歴

- **2026-05-10**: 設計メモ作成 (案 D カメラ実装中の保留)
