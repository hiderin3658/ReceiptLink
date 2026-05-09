import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { NewExpenseFlow } from "@/components/expense/new-expense-flow";
import { listCategories } from "@/lib/expense/categories-server";

export default async function NewExpensePage() {
  const categories = await listCategories();

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
        <h1 className="text-2xl font-bold">支出を登録</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          レシート撮影で自動入力するか、手入力で品目を追加できます
        </p>
      </header>

      <NewExpenseFlow categories={categories} />
    </div>
  );
}
