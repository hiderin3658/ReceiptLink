// 購入日の文字列を <input type="date"> が受け付ける YYYY-MM-DD に正規化する。
//
// extract-receipt Edge Function は Gemini OCR の結果を ISO 8601 (時刻付きを含む)
// として valid 判定するが、ブラウザの date input は YYYY-MM-DD 厳密形式しか
// 受け付けないため空表示になる。さらにレシートの実フォーマットは多様
// (スラッシュ・ピリオド・日本語・和暦等) のため、ここで吸収する。

/** YYYY-MM-DD 文字列に揃える (1 桁の月日は 0 埋め) */
function formatYmd(year: string, month: string, day: string): string {
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/** JST における今日の日付 (YYYY-MM-DD) */
function todayInJst(): string {
  const now = new Date();
  // UTC → JST (+9h) シフトして toISOString で日付部分を取る
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}

/**
 * Gemini OCR が返した purchased_at を YYYY-MM-DD に正規化する。
 *
 * 対応フォーマット:
 *  - ISO 8601 標準 / 時刻付き: `2026-05-10`, `2026-05-10T15:30:00+09:00`
 *  - スラッシュ区切り: `2026/05/10`, `2026/5/10`
 *  - ピリオド区切り: `2026.05.10`, `2026.5.10`
 *  - 西暦日本語: `2026年5月10日`, `2026 年 5 月 10 日`
 *  - 和暦 (令和): `令和8年5月10日`, `令和元年5月10日`, `R8/5/10`, `R8.5.10`
 *  - 和暦 (平成): `平成31年5月10日`, `H31/5/10`, `H31.5.10`
 *
 * 上記いずれにも該当しない / null / 空文字列の場合は JST 今日の日付を返す。
 *
 * 注意: 西暦下 2 桁 (例: `26/5/10`) は 1926 と 2026 の判別不能のため非対応。
 */
export function normalizePurchasedAt(raw: string | null | undefined): string {
  if (!raw) return todayInJst();
  const s = raw.trim();
  if (s === "") return todayInJst();

  // 1. ISO 8601 (時刻部分があっても日付部分のみ採用)
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return formatYmd(m[1]!, m[2]!, m[3]!);

  // 2. スラッシュ or ピリオド区切り (YYYY[/.]M[/.]D)
  m = /^(\d{4})[\/.](\d{1,2})[\/.](\d{1,2})/.exec(s);
  if (m) return formatYmd(m[1]!, m[2]!, m[3]!);

  // 3. 和暦 (令和/平成 + 数字 or 元 + 年/区切り + M + 月/区切り + D)
  //    例: 令和8年5月10日, 令和元年5月10日, R8/5/10, H31.5.10
  m = /^(令和|平成|R|H)\s*(\d+|元)\s*[年\/.](\d{1,2})\s*[月\/.](\d{1,2})/.exec(s);
  if (m) {
    const eraBase = m[1] === "令和" || m[1] === "R" ? 2018 : 1988; // 令和元年=2019, 平成元年=1989
    const offset = m[2] === "元" ? 1 : Number(m[2]);
    if (Number.isFinite(offset) && offset > 0) {
      return formatYmd(String(eraBase + offset), m[3]!, m[4]!);
    }
  }

  // 4. 西暦日本語 (YYYY年M月D日)
  m = /^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})/.exec(s);
  if (m) return formatYmd(m[1]!, m[2]!, m[3]!);

  // どれにも該当しなければ今日にフォールバック (空欄表示の事故を防ぐ)
  return todayInJst();
}
