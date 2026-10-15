"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AdminOverview } from "@showrooms/shared";

type Series = AdminOverview["series"];
const axis = { fontSize: 12, stroke: "#8A8F96" };

export function SeriesChart({ title, data, dataKey, color = "#1C1F23", kind = "area", format }: { title: string; data: Series; dataKey: keyof Series[number]; color?: string; kind?: "area" | "bar"; format?: (n: number) => string }) {
  const total = data.reduce((s, d) => s + Number(d[dataKey]), 0);
  return (
    <div className="rounded-lg border border-border bg-white p-4 shadow-card">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-sm text-ink-muted tabular">{format ? format(total) : total.toLocaleString("en-KE")}</p>
      </div>
      <div className="h-44" role="img" aria-label={`${title} per day`}>
        <ResponsiveContainer>
          {kind === "bar" ? (
            <BarChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke="#E6E6E3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip formatter={(v) => (format ? format(Number(v)) : String(v))} />
              <Bar dataKey={dataKey as string} fill={color} radius={[3, 3, 0, 0]} />
            </BarChart>
          ) : (
            <AreaChart data={data} margin={{ left: -20, right: 4 }}>
              <CartesianGrid stroke="#E6E6E3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} {...axis} />
              <YAxis allowDecimals={false} {...axis} />
              <Tooltip />
              <Area type="monotone" dataKey={dataKey as string} stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
