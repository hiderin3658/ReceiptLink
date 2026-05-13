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
  - total_price: その明細行の **合計金額**（円、整数）。単価ではない:
    - レシートに「188 × 4 = 752」のように単価・数量・合計が並んでいる場合
      → **合計の 752 を採用**（単価の 188 を採用してはならない）
    - 1 行に金額が 1 つだけ記載されている場合 → その金額をそのまま採用
    - **税の換算はしないこと**:
      - 税抜表示のレシート → 税抜価格をそのまま
      - 税込表示のレシート → 税込価格をそのまま
      - 消費税分や全体値引きを按分しない
  - category_hint: 以下のカテゴリ名から最も近いもの 1 つ → ${categoriesList}
- 値引き (discounts): クーポン・割引の項目（label と amount）。無ければ空配列。
- 合計金額 (total_amount): **必ず税込の最終支払額**（円、整数）。
  レシート末尾の「合計」「お支払い」「お預かり」直前の支払額を採用。
  消費税・値引きをすべて加減算した後の、ユーザーが実際に支払った金額。
- 店舗カテゴリヒント (store_category_hint): 以下から推定 → ${storeCatList}。判定不能なら "other"
- 信頼度 (confidence): 0.0〜1.0。読み取りの自信度。

重要なルール:
- 商品の中には食品以外（シャンプー・電池・文房具・衣類など）も含む。すべて抽出すること。
- category_hint は商品の用途で判定する（例: 野菜・肉・調味料 → "食費"、シャンプー・電池 → "日用品"）。
- 数量が明記されていない場合は null を返す（推測しない）。
- 通貨記号（¥）やカンマ（1,500）は除去して整数値に変換すること。
- **価格の方針 (重要)**:
  - 各品目 (items[].total_price) は **その明細行の合計金額をそのまま採用** する。
    レシートに単価と数量と合計が並ぶ場合は合計側を採用すること（単価ではない）。
    税抜・税込どちらかに揃えようとしない。換算もしない。
  - これは家計簿として「品目はレシート通り」「合計は実支払額 (税込)」という
    シンプルな運用とするため。両者の差は消費税や値引きを反映する。
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
