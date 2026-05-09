"use client";

// 月次推移 棒グラフ（Recharts ラッパー）
//
// 設計書: docs/design.md §8

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface MonthlyBarDatum {
  /** YYYY-MM */
  year_month: string;
  total: number;
}

interface Props {
  data: MonthlyBarDatum[];
}

/** YYYY-MM → "M月" or "YYYY年M月" */
function formatLabel(yyyyMm: string): string {
  const [, m] = yyyyMm.split("-");
  return `${Number(m)}月`;
}

export function MonthlyBar({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        データがありません
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="year_month"
          tickFormatter={formatLabel}
          tick={{ fontSize: 12 }}
        />
        <YAxis
          tickFormatter={(v: number) => `¥${(v / 1000).toFixed(0)}k`}
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString()}`}
          labelFormatter={(label: string) => label}
        />
        <Bar dataKey="total" fill="#60a5fa" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
