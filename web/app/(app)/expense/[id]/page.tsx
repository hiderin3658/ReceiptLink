import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getExpenseRecord } from "@/lib/expense/queries";
import { listCategories } from "@/lib/expense/categories-server";
import { DeleteExpenseButton } from "./delete-button";

export const dynamic = "force-dynamic";

const SOURCE_LABEL = {
  receipt: "レシート",
  manual: "手入力",
  recurring: "固定費",
} as const;

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [record, categories] = await Promise.all([
    getExpenseRecord(id),
    listCategories(),
  ]);
  if (!record) {
    notFound();
  }

  const items = record.expense_items ?? [];
  const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href="/expense"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft size={14} aria-hidden />
          支出一覧へ戻る
        </Link>
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">
              {record.store_name ?? "店舗名なし"}
            </h1>
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {formatJapaneseDate(record.purchased_at)} ・ ¥{record.total_amount.toLocaleString()}
              {" ・ "}{SOURCE_LABEL[record.source_type]}
            </p>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/expense/${record.id}/edit`}
              className="flex items-center gap-1 rounded-md border border-[var(--color-border)] bg-white px-3 py-2 text-sm hover:bg-[var(--color-muted)]"
            >
              <Pencil size={14} aria-hidden /> 編集
            </Link>
            <DeleteExpenseButton id={record.id} />
          </div>
        </div>
      </header>

      {record.note && (
        <section className="rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm">
          <span className="text-xs text-[var(--color-muted-foreground)]">メモ</span>
          <p className="mt-1 whitespace-pre-wrap">{record.note}</p>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">明細（{items.length} 件）</h2>
          {record.source_type === "receipt" && (
            <span className="text-xs text-[var(--color-muted-foreground)]">
              ※ 各品目はレシート記載通り (税抜・税込はレシート表示に依存)。合計は税込支払額です
            </span>
          )}
        </div>
        <ul className="rounded-lg border border-[var(--color-border)] bg-white">
          {items.map((it, idx) => (
            <li
              key={it.id}
              className={
                "px-4 py-3 text-sm" + (idx > 0 ? " border-t border-[var(--color-border)]" : "")
              }
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{it.display_name ?? it.raw_name}</span>
                <span className="font-semibold tabular-nums">
                  ¥{it.total_price.toLocaleString()}
                  {it.discount > 0 && (
                    <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
                      (-¥{it.discount.toLocaleString()})
                    </span>
                  )}
                </span>
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
                {categoryNameById.get(it.category_id) ?? "(削除済み)"}
                {it.quantity != null && (
                  <>
                    {" ・ "}
                    {it.quantity}
                    {it.unit ? ` ${it.unit}` : ""}
                  </>
                )}
                {it.unit_price != null && (
                  <> ・ 単価 ¥{it.unit_price.toLocaleString()}</>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** ISO 8601 (YYYY-MM-DD or full timestamp) を 日本語表記に整形 */
function formatJapaneseDate(iso: string): string {
  const ymd = iso.slice(0, 10);
  const [y, m, d] = ymd.split("-");
  return `${y}年${Number(m)}月${Number(d)}日`;
}
