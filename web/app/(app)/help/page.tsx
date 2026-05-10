// 使い方ガイド (ヘルプ) ページ。
//
// 主要操作の説明 + FAQ。テキスト中心、必要に応じて将来スクショを追加可能。
// メンテナンスは本ファイル単独で完結 (動的データ無し)。

import Link from "next/link";

export const metadata = {
  title: "使い方ガイド | ReceiptLink",
};

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">使い方ガイド</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          主要操作の手順とよくある質問をまとめています。
        </p>
      </header>

      {/* 目次 */}
      <nav
        aria-label="目次"
        className="rounded-lg border border-[var(--color-border)] bg-white p-4"
      >
        <h2 className="mb-2 text-sm font-semibold">目次</h2>
        <ol className="ml-5 list-decimal space-y-1 text-sm text-[var(--color-foreground)]">
          <li>
            <a href="#intro" className="text-[var(--color-primary)] hover:underline">
              はじめに
            </a>
          </li>
          <li>
            <a href="#expense-add" className="text-[var(--color-primary)] hover:underline">
              支出を登録する
            </a>
          </li>
          <li>
            <a href="#expense-history" className="text-[var(--color-primary)] hover:underline">
              履歴を確認・編集する
            </a>
          </li>
          <li>
            <a href="#recurring" className="text-[var(--color-primary)] hover:underline">
              固定費を毎月計上する
            </a>
          </li>
          <li>
            <a href="#reports" className="text-[var(--color-primary)] hover:underline">
              レポートを見る
            </a>
          </li>
          <li>
            <a href="#csv" className="text-[var(--color-primary)] hover:underline">
              CSV エクスポート
            </a>
          </li>
          <li>
            <a href="#faq" className="text-[var(--color-primary)] hover:underline">
              よくある質問 (FAQ)
            </a>
          </li>
        </ol>
      </nav>

      {/* 1. はじめに */}
      <Section id="intro" title="1. はじめに">
        <p>
          ReceiptLink は、レシート写真を撮るだけで家計簿が完成するアプリです。
          OCR (AI による画像認識) で品目・店舗・合計を自動入力し、必要に応じて
          手動で支出を追加することもできます。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>レシート OCR (カメラ撮影 / 画像選択)</li>
          <li>手入力でも登録可能</li>
          <li>固定費 (家賃・サブスク等) の月次計上</li>
          <li>カテゴリ別の集計 / 月次レポート / CSV 出力</li>
        </ul>
      </Section>

      {/* 2. 支出を登録する */}
      <Section id="expense-add" title="2. 支出を登録する">
        <p>
          下部ナビの「<strong>追加</strong>」または、ホーム画面の「
          <strong>支出を登録</strong>」ボタンから登録画面に進みます。
        </p>

        <h3 className="mt-3 text-sm font-semibold">2-1. レシートで自動入力</h3>
        <p>
          画面上部の「<strong>カメラで撮影</strong>」または「
          <strong>画像を選択</strong>」を選びます。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>カメラで撮影</strong>: アプリ内でカメラが起動します。シャッターを押すと
            すぐに画像が取り込まれます。
          </li>
          <li>
            <strong>画像を選択</strong>: スマートフォンの写真ライブラリやファイルから
            既に保存済みのレシート画像を選択します。
          </li>
        </ul>
        <p>
          画像を選択すると「品目を抽出」ボタンが表示されます。クリックすると
          AI がレシートを解析し、店舗名・購入日・品目・合計を自動入力します
          (約 10〜20 秒)。
        </p>

        <h3 className="mt-3 text-sm font-semibold">2-2. 手入力で登録</h3>
        <p>
          レシートが無い場合や OCR を使わない場合は、画像を取り込まずに
          そのままフォームを入力してください。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>合計金額</strong>: 何も入れなければ品目の合計が自動採用されます。
            消費税込みの実支払額を入れたい場合は、合計欄に直接入力してください。
          </li>
          <li>
            <strong>品目</strong>: 「行を追加」ボタンで複数登録できます。各行に
            品名・カテゴリ・金額・値引を入力します。
          </li>
        </ul>
      </Section>

      {/* 3. 履歴を確認・編集する */}
      <Section id="expense-history" title="3. 履歴を確認・編集する">
        <p>
          下部ナビの「<strong>履歴</strong>」から、登録した支出の一覧を見られます。
          月別合計と最近の支出が新しい順で並びます。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>各カードをタップ → 詳細画面で品目・カテゴリ・金額を確認</li>
          <li>詳細画面右上の「編集」で店舗名や金額を変更可能</li>
          <li>「削除」で支出レコードを削除 (確認ダイアログあり)</li>
        </ul>
      </Section>

      {/* 4. 固定費 */}
      <Section id="recurring" title="4. 固定費を毎月計上する">
        <p>
          家賃・サブスク・光熱費など毎月決まった金額の支出は「固定費」として
          登録しておくと、毎月ボタン 1 つで一括計上できます。
        </p>

        <h3 className="mt-3 text-sm font-semibold">4-1. 固定費を登録する</h3>
        <ol className="ml-5 list-decimal space-y-1">
          <li>下部ナビの「<strong>設定</strong>」を開く</li>
          <li>「固定費管理」セクションの「+ 追加」ボタンをクリック</li>
          <li>名前・カテゴリ・金額・計上日を入力して「追加」</li>
        </ol>

        <h3 className="mt-3 text-sm font-semibold">4-2. 月次計上する</h3>
        <p>
          ホーム画面の上部に「<strong>未計上の固定費が N 件あります</strong>」
          アラートが表示されます。「N 件を計上」ボタンを押すと、未計上分が
          まとめて支出履歴に登録されます。
        </p>

        <h3 className="mt-3 text-sm font-semibold">4-3. 変動する固定費 (例: 携帯代)</h3>
        <p>
          請求額が月によって変わる場合は、以下のいずれかで対応してください:
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            計上ボタンを押す前に「設定 → 固定費管理」で金額を編集してから計上
          </li>
          <li>
            ボタンを押して一括計上した後、履歴から該当レコードを開いて金額を編集
          </li>
        </ul>
      </Section>

      {/* 5. レポート */}
      <Section id="reports" title="5. レポートを見る">
        <p>
          下部ナビの「<strong>レポート</strong>」で、月次推移とカテゴリ別内訳を
          確認できます。
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>「前月」「次月」リンクで月を切替</li>
          <li>「6ヶ月」「12ヶ月」で月次推移グラフの範囲を切替</li>
          <li>カテゴリ別円グラフで内訳を可視化</li>
        </ul>
      </Section>

      {/* 6. CSV */}
      <Section id="csv" title="6. CSV エクスポート">
        <p>
          履歴一覧の右上「CSV」ボタン、またはレポート画面下部の
          「全期間 CSV をダウンロード」から、すべての支出を CSV 形式で
          ダウンロードできます。
        </p>
        <p>
          Excel・Google スプレッドシート等で開けます。日付・店舗・カテゴリ・
          金額などの 14 列を含みます。
        </p>
      </Section>

      {/* 7. FAQ */}
      <Section id="faq" title="7. よくある質問 (FAQ)">
        <FaqItem q="OCR で日付が空欄になったら?">
          <p>
            レシートの日付フォーマットによっては読み取りに失敗することがあります。
            購入日欄に直接日付を入力してください。
          </p>
        </FaqItem>

        <FaqItem q="OCR の精度を上げるには?">
          <ul className="ml-5 list-disc space-y-1">
            <li>レシート全体が画像に収まるように撮影</li>
            <li>明るい場所で、影が入らないよう撮影</li>
            <li>レシートを平らに伸ばして撮影</li>
            <li>カメラがブレないよう両手で固定</li>
          </ul>
        </FaqItem>

        <FaqItem q="撮影でメモリ不足になる場合は?">
          <p>
            Android 標準カメラの設定で <strong>HDR / AI 補正 / 高解像度</strong>
            をオフにしてみてください。または、別のカメラアプリで撮影してから
            「画像を選択」で取り込む方法もあります。
          </p>
        </FaqItem>

        <FaqItem q="品目合計と合計金額がズレているのはなぜ?">
          <p>
            レシート品目はそのまま記載、合計は支払額 (税込) で記録する仕様です。
            差は消費税や全体の値引き分です。詳細画面の明細欄上部に注釈が出ます。
          </p>
        </FaqItem>

        <FaqItem q="固定費の金額を変えたら過去の履歴も変わりますか?">
          <p>
            いいえ、過去にすでに計上した分はそのまま残ります。次の月から
            新しい金額で計上されます。過去分も修正したい場合は履歴から
            個別に編集してください。
          </p>
        </FaqItem>

        <FaqItem q="ログアウトはどこから?">
          <p>
            設定画面の最下部「アカウント」セクションに
            「ログアウト」ボタンがあります。
          </p>
        </FaqItem>
      </Section>

      {/* フッター */}
      <p className="pt-4 text-center text-xs text-[var(--color-muted-foreground)]">
        操作で困ったことがあれば、まずはこのページを確認してみてください。
      </p>
      <p className="text-center text-xs">
        <Link href="/dashboard" className="text-[var(--color-primary)] hover:underline">
          ← ホームに戻る
        </Link>
      </p>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-4 space-y-2 rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm leading-relaxed"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function FaqItem({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-md border border-[var(--color-border)] bg-[var(--color-muted)] p-3">
      <summary className="cursor-pointer text-sm font-medium">
        <span className="mr-1">Q.</span>
        {q}
      </summary>
      <div className="mt-2 space-y-1 text-sm">{children}</div>
    </details>
  );
}
