"use client";

// /expense/new の状態機: レシート OCR → ExpenseForm プリフィル の流れ。
//
// 設計判断:
// - サーバー RSC（page.tsx）はレイアウトとヘッダのみ（categories の取得もここで実施）
// - 本コンポーネントが OCR の有無・結果の状態を保持して切替
// - OCR 成功時は ExpenseForm を key で remount してプリフィル

import { useState } from "react";
import { ReceiptUploader } from "./receipt-uploader";
import { ExpenseForm } from "./expense-form";
import { ocrToExpenseInput, type OcrResult } from "@/lib/expense/ocr";
import type { ExpenseRecordInput } from "@/lib/expense/schema";
import type { ExpenseCategory } from "@/types/database";

interface Props {
  categories: ExpenseCategory[];
}

export function NewExpenseFlow({ categories }: Props) {
  const [initial, setInitial] = useState<ExpenseRecordInput | null>(null);
  const [ocrCompleted, setOcrCompleted] = useState(false);

  function handleOcrResult(ocr: OcrResult, imagePath: string) {
    setInitial(ocrToExpenseInput(ocr, [imagePath], categories));
    setOcrCompleted(true);
  }

  function handleSwitchToManual() {
    // ExpenseForm を key で remount するため、手入力中の入力内容も失われる旨を確認
    if (!confirm("手入力に切り替えますと、OCR で自動入力された内容は破棄されます。よろしいですか？")) {
      return;
    }
    setInitial(null);
    setOcrCompleted(false);
  }

  return (
    <div className="space-y-6">
      {!ocrCompleted && <ReceiptUploader onResult={handleOcrResult} />}

      {ocrCompleted && (
        <div className="rounded-lg border border-[color-mix(in_oklch,var(--color-primary)_30%,transparent)] bg-[color-mix(in_oklch,var(--color-primary)_5%,white)] p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <span>
              ✅ レシートを読み取りました。下の品目リストを確認・修正してください。
            </span>
            <button
              type="button"
              onClick={handleSwitchToManual}
              className="rounded-md border border-[var(--color-border)] bg-white px-3 py-1 text-xs hover:bg-[var(--color-muted)]"
            >
              手入力に切替
            </button>
          </div>
        </div>
      )}

      <ExpenseForm
        // OCR 結果が変わるたびにフォームを再生成して initial を反映
        key={ocrCompleted ? "ocr" : "manual"}
        mode="create"
        categories={categories}
        initial={initial ?? undefined}
      />
    </div>
  );
}
