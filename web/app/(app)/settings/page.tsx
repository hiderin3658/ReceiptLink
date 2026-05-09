// 設定: 暫定スタブ（PR-6 で本格実装に置き換え）
// 設計: docs/design.md §5

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          設定画面（プロフィール / カテゴリ管理 / 固定費管理 / ホワイトリスト管理）は PR-6 で実装予定です。
        </p>
      </header>
    </div>
  );
}
