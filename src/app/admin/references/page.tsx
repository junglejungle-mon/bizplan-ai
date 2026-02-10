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

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "대기", color: "bg-gray-100 text-gray-700" },
  processing: { label: "처리중", color: "bg-yellow-100 text-yellow-700" },
  completed: { label: "완료", color: "bg-green-100 text-green-700" },
  failed: { label: "실패", color: "bg-red-100 text-red-700" },
};

const REFERENCE_TYPES = [
  { value: "", label: "전체" },
  { value: "business_plan", label: "사업계획서" },
  { value: "ir_ppt", label: "IR PPT" },
];

export default function AdminReferencesPage() {
  const [documents, setDocuments] = useState<ReferenceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ referenceType: "", status: "" });
  const [showUpload, setShowUpload] = useState(false);

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

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">레퍼런스 관리</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
        >
          + 업로드
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-3 mb-4">
        <select
          value={filter.referenceType}
          onChange={(e) => setFilter((f) => ({ ...f, referenceType: e.target.value }))}
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
        >
          {REFERENCE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={filter.status}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
          className="h-9 rounded-lg border border-gray-300 px-3 text-sm"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="processing">처리중</option>
          <option value="completed">완료</option>
          <option value="failed">실패</option>
        </select>
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-3 font-medium text-gray-600">제목</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">타입</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">템플릿</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">청크수</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">생성일</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  로딩 중...
                </td>
              </tr>
            ) : documents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  레퍼런스가 없습니다
                </td>
              </tr>
            ) : (
              documents.map((doc) => {
                const status = STATUS_LABELS[doc.status] || STATUS_LABELS.pending;
                return (
                  <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/references/${doc.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {doc.title}
                      </Link>
                      <div className="text-xs text-gray-400 mt-0.5">{doc.file_name}</div>
                    </td>
                    <td className="px-4 py-3">
                      {doc.reference_type === "business_plan" ? "사업계획서" : "IR PPT"}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.template_type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{doc.chunk_count}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {new Date(doc.created_at).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/references/${doc.id}`}
                        className="text-sm text-gray-500 hover:text-gray-700"
                      >
                        상세
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 업로드 모달 */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            fetchDocuments();
          }}
        />
      )}
    </div>
  );
}

function UploadModal({
  onClose,
  onUploaded,
}: {
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [referenceType, setReferenceType] = useState("business_plan");
  const [templateType, setTemplateType] = useState("custom");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleUpload() {
    if (!file || !title) return;
    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", title);
      formData.append("reference_type", referenceType);
      formData.append("template_type", templateType);

      const res = await fetch("/api/admin/references", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        onUploaded();
      } else {
        const data = await res.json();
        setError(data.error || "업로드 실패");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6">
        <h2 className="text-lg font-semibold mb-4">레퍼런스 업로드</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              PDF 파일
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              placeholder="레퍼런스 제목"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                타입
              </label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              >
                <option value="business_plan">사업계획서</option>
                <option value="ir_ppt">IR PPT</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                템플릿 유형
              </label>
              <select
                value={templateType}
                onChange={(e) => setTemplateType(e.target.value)}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm"
              >
                <option value="custom">Custom</option>
                <option value="startup_package">초기창업패키지</option>
                <option value="growth_package">창업도약패키지</option>
                <option value="dips">DIPS</option>
                <option value="export_voucher">수출바우처</option>
                <option value="sme_fund">중소기업진흥공단</option>
                <option value="innovation_growth">혁신성장</option>
              </select>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="h-10 px-4 rounded-lg border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            onClick={handleUpload}
            disabled={!file || !title || uploading}
            className="h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {uploading ? "업로드 중..." : "업로드"}
          </button>
        </div>
      </div>
    </div>
  );
}
