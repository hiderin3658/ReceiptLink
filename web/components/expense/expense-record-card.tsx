// 支出履歴の 1 行表示用カード（Server Component で使う想定）

import Link from "next/link";
import { ChevronRight, Receipt as ReceiptIcon, Pencil, Repeat } from "lucide-react";
import type { ExpenseRecord } from "@/types/database";

const SourceIcon = {
  receipt: ReceiptIcon,
  manual: Pencil,
  recurring: Repeat,
} as const;

export function ExpenseRecordCard({ record }: { record: ExpenseRecord }) {
  const Icon = SourceIcon[record.source_type];
  return (
    <Link
      href={`/expense/${record.id}`}
      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white p-4 transition-colors hover:bg-[var(--color-muted)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Icon size={14} className="shrink-0 text-[var(--color-muted-foreground)]" aria-hidden />
          <span className="text-sm font-medium break-words">
            {record.store_name ?? "店舗名なし"}
          </span>
        </div>
        <div className="mt-1 text-xs text-[var(--color-muted-foreground)]">
          {formatJapaneseDate(record.purchased_at)}
        </div>
      </div>
      <div className="ml-4 flex items-center gap-2">
        <span className="font-semibold tabular-nums">
          ¥{record.total_amount.toLocaleString()}
        </span>
        <ChevronRight size={16} className="text-[var(--color-muted-foreground)]" aria-hidden />
      </div>
    </Link>
  );
}

/** ISO 8601 (YYYY-MM-DD or full timestamp) を 日本語表記に整形 */
function formatJapaneseDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [y, m, d] = ymd.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
