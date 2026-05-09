# Legacy（OkazuLink 由来ドキュメント）

このディレクトリには、**ReceiptLink の元になった姉妹アプリ「OkazuLink」のドキュメント**を保管しています。
ReceiptLink の現行設計とは目的が異なる（料理・栄養管理 vs 家計簿）ため `docs/` 直下からは外していますが、以下の用途で参照価値があります。

- 認証・OCR・Storage の共通仕様の出典確認
- 過去の Phase 1 / Phase 2 で実施したテスト手順・結果のリファレンス
- 将来 ReceiptLink で類似機能を実装する際のヒント

## 含まれるファイル

| ファイル | 元ファイル名 | 内容 |
|---|---|---|
| `design.md` | `design.md.okazu-original.md` | OkazuLink 全体設計書 v0.7（料理・栄養・体重管理） |
| `phase1-implementation-plan.md` | `phase1-implementation-plan.okazu-original.md` | OkazuLink Phase 1 実装計画 |
| `phase-1-2-test-plan.md` | `phase-1-2-test-plan.okazu-original.md` | OkazuLink Phase 1+2 統合テスト計画 |
| `phase-1-2-test-result.md` | `phase-1-2-test-result.okazu-original.md` | OkazuLink Phase 1+2 統合テスト結果 |

## ReceiptLink の最新ドキュメント

- 要件: [`../requirements.md`](../requirements.md)
- 設計: [`../design.md`](../design.md)
- 共通利用部分の仕様: [`../receipt-scan-spec.md`](../receipt-scan-spec.md)
- 実装 TODO: [`../adaptation-todo.md`](../adaptation-todo.md)
