"use client";

// カテゴリ別 円グラフ（Recharts ラッパー）
//
// 設計書: docs/design.md §8

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface CategoryPieDatum {
  category_id: string;
  name: string;
  value: number; // 円
}

// 標準 6 カテゴリ + その他に対する固定カラー（視認性重視）
const COLOR_PALETTE = [
  "#fb923c", // 食費 (orange-400)
  "#60a5fa", // 日用品 (blue-400)
  "#facc15", // 光熱費 (yellow-400)
  "#34d399", // 交通費 (emerald-400)
  "#c084fc", // 娯楽 (purple-400)
  "#94a3b8", // その他 (slate-400)
  "#f472b6", // pink-400
  "#22d3ee", // cyan-400
  "#a3e635", // lime-400
];

interface Props {
  data: CategoryPieDatum[];
  /** 総額（中央に表示するなら呼出側で別途用意。本コンポーネントは表示しない） */
}

export function CategoryPie({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--color-muted-foreground)]">
        データがありません
      </p>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={90}
          labelLine={false}
        >
          {data.map((entry, idx) => (
            <Cell key={entry.category_id} fill={COLOR_PALETTE[idx % COLOR_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number) => `¥${value.toLocaleString()}`}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value: string) => (
            <span className="text-xs text-[var(--color-foreground)]">{value}</span>
          )}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
