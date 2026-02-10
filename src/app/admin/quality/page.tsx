"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface ReferenceDocument {
  id: string;
  title: string;
  file_name: string;
  reference_type: string;
  template_type: string;
  status: string;
  chunk_count: number;
  created_at: string;
}

interface QualityScore {
  id: string;
  plan_id: string;
  section_id: string | null;
  total_score: number;
  score_numeric_evidence: number;
  score_tam_sam_som: number;
  score_competitor_analysis: number;
  score_roadmap: number;
  score_team_capability: number;
  score_budget_basis: number;
  score_risk_mitigation: number;
  score_ip_patent: number;
  score_social_value: number;
  score_document_fit: number;
  score_charts_tables: number;
  improvement_suggestions: string[];
  created_at: string;
  plan_sections?: { section_name: string };
  business_plans?: { title: string };
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-gray-100 text-gray-700" },
  processing: { label: "처리중", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  failed: { label: "실패", color: "bg-red-100 text-red-700" },
};

export default function AdminQualityPage() {
  const [tab, setTab] = useState<"references" | "scores">("references");
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
  const [scores, setScores] = useState<QualityScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [filter, setFilter] = useState({ referenceType: "", status: "" });

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter.referenceType) params.set("reference_type", filter.referenceType);
    if (filter.status) params.set("status", filter.status);
    const res = await fetch(`/api/admin/references?${params}`);
    if (res.ok) {
      const data = await res.json();
      setDocuments(data.documents || []);
    }
    setLoading(false);
  }, [filter]);

  const fetchScores = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/quality/scores");
    if (res.ok) {
      const data = await res.json();
      setScores(data.scores || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "references") fetchDocuments();
    if (tab === "scores") fetchScores();
  }, [tab, fetchDocuments, fetchScores]);

  const scoreItems = [
    { key: "score_numeric_evidence", label: "숫자실적", max: 15 },
    { key: "score_tam_sam_som", label: "TAM/SAM/SOM", max: 10 },
    { key: "score_competitor_analysis", label: "경쟁사분석", max: 10 },
    { key: "score_roadmap", label: "로드맵", max: 10 },
    { key: "score_team_capability", label: "팀역량", max: 10 },
    { key: "score_budget_basis", label: "사업비", max: 10 },
    { key: "score_risk_mitigation", label: "리스크", max: 5 },
    { key: "score_ip_patent", label: "특허/IP", max: 5 },
    { key: "score_social_value", label: "사회적가치", max: 5 },
    { key: "score_document_fit", label: "분량적합", max: 10 },
    { key: "score_charts_tables", label: "차트/표", max: 10 },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">품질 / RAG 관리</h1>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { key: "references" as const, label: "레퍼런스 관리" },
          { key: "scores" as const, label: "품질 채점" },
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

      {/* 레퍼런스 관리 (기존 로직) */}
      {tab === "references" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-3">
              <select
                value={filter.referenceType}
                onChange={(e) => setFilter((f) => ({ ...f, referenceType: e.target.value }))}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
              >
                <option value="">전체 타입</option>
                <option value="business_plan">사업계획서</option>
                <option value="ir_ppt">IR PPT</option>
              </select>
              <select
                value={filter.status}
                onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
              >
                <option value="">전체 상태</option>
                <option value="completed">완료</option>
                <option value="failed">실패</option>
                <option value="pending">대기</option>
              </select>
            </div>
            <button
              onClick={() => setShowUpload(true)}
              className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
            >
              + 업로드
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">제목</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">타입</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">청크</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">생성일</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">로딩 중...</td></tr>
                ) : documents.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">레퍼런스가 없습니다</td></tr>
                ) : documents.map((doc) => {
                  const status = STATUS_LABELS[doc.status] || STATUS_LABELS.pending;
                  return (
                    <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link href={`/admin/references/${doc.id}`} className="text-blue-600 hover:underline font-medium">
                          {doc.title}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{doc.reference_type === "business_plan" ? "사업계획서" : "IR PPT"}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{doc.chunk_count}</td>
                      <td className="px-4 py-3 text-gray-400">{new Date(doc.created_at).toLocaleDateString("ko-KR")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 품질 채점 */}
      {tab === "scores" && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : scores.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="mb-2">채점 데이터 없음</p>
              <p className="text-xs">사업계획서 생성 시 자동으로 채점됩니다</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scores.map((score) => (
                <div key={score.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">
                        {score.business_plans?.title || "플랜"}
                        {score.plan_sections?.section_name && (
                          <span className="text-gray-400 font-normal ml-2">/ {score.plan_sections.section_name}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">{new Date(score.created_at).toLocaleString("ko-KR")}</div>
                    </div>
                    <div className={`text-2xl font-bold ${
                      score.total_score >= 80 ? "text-green-600" :
                      score.total_score >= 60 ? "text-yellow-600" :
                      "text-red-600"
                    }`}>
                      {score.total_score}점
                    </div>
                  </div>

                  {/* 항목별 점수 바 */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 mt-3">
                    {scoreItems.map((item) => {
                      const val = (score as any)[item.key] || 0;
                      const pct = Math.round((val / item.max) * 100);
                      return (
                        <div key={item.key} className="text-center">
                          <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                          <div className="w-full bg-gray-100 rounded-full h-1.5">
                            <div
                              className={`h-1.5 rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 50 ? "bg-yellow-500" : "bg-red-400"}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-gray-500 mt-0.5">{val}/{item.max}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* 개선 제안 */}
                  {score.improvement_suggestions && score.improvement_suggestions.length > 0 && (
                    <div className="mt-3 bg-yellow-50 rounded-lg p-3">
                      <div className="text-xs font-medium text-yellow-800 mb-1">개선 제안:</div>
                      {score.improvement_suggestions.map((s, i) => (
                        <div key={i} className="text-xs text-yellow-700">- {s}</div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
