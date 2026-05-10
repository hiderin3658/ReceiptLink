import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getExpenseRecord } from "@/lib/expense/queries";
import { listCategories } from "@/lib/expense/categories-server";
import { ExpenseForm } from "@/components/expense/expense-form";
import type { ExpenseRecordInput } from "@/lib/expense/schema";

export const dynamic = "force-dynamic";

export default async function EditExpensePage({
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

  const initial: ExpenseRecordInput = {
    // record.purchased_at は timestamptz の ISO 8601 文字列。
    // <input type="date"> は YYYY-MM-DD のみ受け付けるため日付部分のみ抽出する。
    purchased_at: record.purchased_at.slice(0, 10),
    store_name: record.store_name ?? "",
    total_amount: record.total_amount,
    note: record.note ?? "",
    source_type: record.source_type,
    image_paths: record.image_paths ?? [],
    items: (record.expense_items ?? []).map((it) => ({
      raw_name: it.raw_name,
      display_name: it.display_name ?? "",
      category_id: it.category_id,
      quantity: it.quantity ?? null,
      unit: it.unit ?? "",
      unit_price: it.unit_price ?? null,
      total_price: it.total_price,
      discount: it.discount,
    })),
  };

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <Link
          href={`/expense/${id}`}
          className="inline-flex items-center gap-1 text-xs text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
        >
          <ArrowLeft size={14} aria-hidden />
          詳細に戻る
        </Link>
        <h1 className="text-2xl font-bold">支出を編集</h1>
      </header>

      <ExpenseForm mode="edit" categories={categories} recordId={id} initial={initial} />
    </div>
  );
}
