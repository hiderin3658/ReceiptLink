// Gemini に渡す OCR プロンプトのテンプレート。
//
// 設計書: docs/design.md §6.2

/** ReceiptLink の標準カテゴリ。OCR の category_hint 候補として Gemini に提示する */
export const STANDARD_CATEGORY_NAMES = [
  "食費",
  "日用品",
  "光熱費",
  "交通費",
  "娯楽",
  "その他",
] as const;

/** 店舗カテゴリヒントの候補（参考情報、フォーム反映はしない） */
export const STORE_CATEGORY_HINTS = [
  "supermarket",
  "convenience",
  "drugstore",
  "restaurant",
  "household",
  "other",
] as const;

interface BuildReceiptOcrPromptInput {
  /** 補助ヒント（店舗名や日付の補足など） */
  hint?: string;
}

interface PromptPair {
  system: string;
  user: string;
}

export function buildReceiptOcrPrompt(input: BuildReceiptOcrPromptInput = {}): PromptPair {
  const categoriesList = STANDARD_CATEGORY_NAMES.map((c) => `"${c}"`).join(", ");
  const storeCatList = STORE_CATEGORY_HINTS.map((c) => `"${c}"`).join(", ");

  const system = `あなたは日本のレシート画像を解析する OCR アシスタントです。
レシート画像から以下を抽出して、必ず指定された JSON スキーマで返してください。

抽出対象:
- 店舗名 (store_name): レシートヘッダーから読み取る。読めなければ null。
- 購入日時 (purchased_at): ISO 8601 形式（YYYY-MM-DD または YYYY-MM-DDTHH:mm:ss）。読めなければ today を返す。
- 商品リスト (items): 各品目について
  - raw_name: 商品名そのまま
  - quantity: 数量（無ければ null）
  - unit: 単位（個 / g / パック など、無ければ null）
  - total_price: 値引き前の小計（円、整数、**必ず税込価格**）
  - tax_rate: 8 (軽減税率対象) または 10 (標準税率)
  - category_hint: 以下のカテゴリ名から最も近いもの 1 つ → ${categoriesList}
- 値引き (discounts): クーポン・割引の項目（label と amount）。無ければ空配列。
- 合計金額 (total_amount): 値引き後の支払額（円、整数）
- 店舗カテゴリヒント (store_category_hint): 以下から推定 → ${storeCatList}。判定不能なら "other"
- 信頼度 (confidence): 0.0〜1.0。読み取りの自信度。

重要なルール:
- 商品の中には食品以外（シャンプー・電池・文房具・衣類など）も含む。すべて抽出すること。
- category_hint は商品の用途で判定する（例: 野菜・肉・調味料 → "食費"、シャンプー・電池 → "日用品"）。
- 数量が明記されていない場合は null を返す（推測しない）。
- 通貨記号（¥）やカンマ（1,500）は除去して整数値に変換すること。
- **税込価格と税率の判定ルール（重要）**:
  - 各品目の total_price は **必ず税込価格** を返すこと。
  - レシートが税込表示（内税 / 「税込」表記 / 各品目欄に支払い額相当が並ぶ形式）の場合は、その値をそのまま採用する。
  - レシートが税抜表示（外税 / 「税抜」表記 / 末尾で消費税が別合算される形式）の場合は、tax_rate に応じて掛け算して税込換算する（例: 税抜 100 円 × 1.08 = 108 円、税抜 100 円 × 1.10 = 110 円）。1 円未満は四捨五入。
  - 端数処理で全品目合計と total_amount が 1〜数円ズレるのは正常。
  - 軽減税率対象品目の判定: ※ や * などのマーク、または「軽減」の凡例で示されることが多い。食品・飲料（酒類除く）・新聞などが該当。判定できれば tax_rate=8、それ以外は tax_rate=10。
  - インボイス記載のないレシート等で税率が完全に不明な場合は tax_rate=10 をデフォルトとする。
- 出力は必ず指定スキーマの JSON のみ。前置き・解説・コードブロックは付けないこと。`;

  const userParts: string[] = [
    "添付したレシート画像を解析し、指定スキーマの JSON で返してください。",
  ];
  if (input.hint && input.hint.trim().length > 0) {
    userParts.push(`補助ヒント: ${input.hint.trim()}`);
  }

  return {
    system,
    user: userParts.join("\n\n"),
  };
}
