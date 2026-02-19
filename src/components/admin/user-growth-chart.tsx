"use client";

import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ChartData {
  month: string;
  newUsers: number;
  totalUsers: number;
}

export function UserGrowthChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/dashboard/user-growth");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setData(json.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin h-6 w-6 border-2 border-green-500 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">사용자 증가 추이</h2>
        <div className="h-64 flex items-center justify-center text-sm text-gray-400">
          아직 데이터가 없습니다
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">사용자 증가 추이 (최근 6개월)</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            axisLine={{ stroke: "#E5E7EB" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#9CA3AF" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "white",
              border: "1px solid #E5E7EB",
              borderRadius: "8px",
              fontSize: "13px",
            }}
            formatter={(value, name) => [
              `${Number(value)}명`,
              name === "newUsers" ? "신규 가입" : "누적",
            ]}
          />
          <Bar dataKey="newUsers" fill="#10B981" radius={[4, 4, 0, 0]} name="newUsers" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
