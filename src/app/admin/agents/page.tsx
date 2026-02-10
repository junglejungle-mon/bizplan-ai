"use client";

import { useEffect, useState } from "react";

interface Pattern {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  good_examples: string[];
  bad_examples: string[];
  weight: number;
  is_active: boolean;
}

interface AgentLog {
  id: string;
  skill_name: string;
  action: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  model_used: string;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
}

const SKILL_CATALOG = [
  { id: "16-business-plan-writer", name: "사업계획서 작성", desc: "3단계 공정 + 12건 선정패턴", status: "active" },
  { id: "17-ir-ppt-writer", name: "IR PPT 생성", desc: "2단계 공정 + 13장 표준구조", status: "active" },
  { id: "00-quality", name: "품질 검수", desc: "100점 자동 채점 + 개선 제안", status: "active" },
  { id: "01-ceo-strategy", name: "CEO 전략분석", desc: "다관점 토론식 분석 (8에이전트)", status: "planned" },
  { id: "09-business-dev", name: "사업개발", desc: "공고 분석 → 전략 → 검증", status: "planned" },
  { id: "06-finance", name: "재무 분석", desc: "손익분석 + 예측", status: "planned" },
  { id: "13-data", name: "데이터 관리", desc: "수집/정제/통합 파이프라인", status: "planned" },
];

export default function AdminAgentsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [tab, setTab] = useState<"catalog" | "patterns" | "logs">("catalog");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (tab === "patterns") {
      setLoading(true);
      fetch("/api/admin/quality/patterns")
        .then((r) => r.json())
        .then((data) => setPatterns(data.patterns || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    if (tab === "logs") {
      setLoading(true);
      fetch("/api/admin/system/status")
        .then((r) => r.json())
        .then((data) => setLogs(data.recentLogs || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [tab]);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">에이전트 스킬 관리</h1>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "catalog" as const, label: "스킬 카탈로그" },
          { key: "patterns" as const, label: "선정 패턴" },
          { key: "logs" as const, label: "실행 로그" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 스킬 카탈로그 */}
      {tab === "catalog" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {SKILL_CATALOG.map((skill) => (
            <div key={skill.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">{skill.name}</h3>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  skill.status === "active"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {skill.status === "active" ? "활성" : "예정"}
                </span>
              </div>
              <p className="text-xs text-gray-500 mb-3">{skill.desc}</p>
              <div className="text-xs text-gray-400 font-mono">{skill.id}</div>
            </div>
          ))}
        </div>
      )}

      {/* 선정 패턴 */}
      {tab === "patterns" && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-8 text-gray-400">패턴 데이터 없음 (시딩 필요)</div>
          ) : (
            <div className="space-y-4">
              {patterns.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        {p.weight}점
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">{p.category} / {p.subcategory}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{p.description}</p>
                  {p.good_examples && p.good_examples.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-green-700 mb-1">Good:</div>
                      {p.good_examples.slice(0, 2).map((ex, i) => (
                        <div key={i} className="text-xs text-green-600 bg-green-50 rounded px-2 py-1 mb-1 truncate">
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}
                  {p.bad_examples && p.bad_examples.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-700 mb-1">Bad:</div>
                      {p.bad_examples.slice(0, 2).map((ex, i) => (
                        <div key={i} className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-1 truncate">
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 실행 로그 */}
      {tab === "logs" && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">실행 로그 없음</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">스킬</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">토큰</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">비용</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-mono text-xs">{log.skill_name}</td>
                      <td className="px-4 py-3 text-xs">{log.action}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          log.status === "completed" ? "bg-green-100 text-green-700" :
                          log.status === "failed" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>{log.status}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(log.input_tokens + log.output_tokens).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        ${log.cost_usd?.toFixed(4) || "0"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
