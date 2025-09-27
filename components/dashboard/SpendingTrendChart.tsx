"use client"

import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

export type TrendPoint = { month: string; total: number }

export function SpendingTrendChart({ data }: { data: TrendPoint[] }) {
  const tickFormatter = (v: number) => `¥${v.toLocaleString()}`
  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <defs>
            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" tick={{ fontSize: 12 }} />
          <YAxis tickFormatter={tickFormatter as any} width={72} tick={{ fontSize: 12 }} />
          <Tooltip formatter={(v: any) => [`¥${Number(v).toLocaleString()}`, '合計']} labelFormatter={(l) => `${l} の支出`} />
          <Area type="monotone" dataKey="total" stroke="#3b82f6" fillOpacity={1} fill="url(#colorTotal)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default SpendingTrendChart

