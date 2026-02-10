"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ReferenceDocument {
  id: string;
  title: string;
  file_name: string;
  file_url: string | null;
  reference_type: string;
  template_type: string;
  status: string;
  ocr_text: string | null;
  metadata: Record<string, unknown> | null;
  chunk_count: number;
  created_at: string;
  updated_at: string;
}

interface Chunk {
  id: string;
  section_name: string | null;
  chunk_index: number;
  content: string;
  token_count: number;
}

export default function AdminReferenceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [doc, setDoc] = useState<ReferenceDocument | null>(null);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processLog, setProcessLog] = useState<string[]>([]);
  const [showOcr, setShowOcr] = useState(false);

  const fetchDocument = useCallback(async () => {
    const res = await fetch(`/api/admin/references/${id}`);
    if (res.ok) {
      const data = await res.json();
      setDoc(data.document);
      setChunks(data.chunks || []);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchDocument();
  }, [fetchDocument]);

  async function handleProcess() {
    setProcessing(true);
    setProcessLog([]);

    try {
      const res = await fetch(`/api/admin/references/${id}/process`, {
        method: "POST",
      });

      if (!res.ok) {
        setProcessLog((prev) => [...prev, `오류: ${res.statusText}`]);
        setProcessing(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((l) => l.startsWith("data: "));

          for (const line of lines) {
            try {
              const event = JSON.parse(line.slice(6));
              setProcessLog((prev) => [
                ...prev,
                `[${event.progress}%] ${event.step}${event.detail ? ` — ${event.detail}` : ""}`,
              ]);
            } catch {}
          }
        }
      }

      await fetchDocument();
    } catch (e) {
      setProcessLog((prev) => [...prev, `오류: ${String(e)}`]);
    }

    setProcessing(false);
  }

  async function handleDelete() {
    if (!confirm("이 레퍼런스를 삭제하시겠습니까?")) return;

    const res = await fetch(`/api/admin/references/${id}`, {
      method: "DELETE",
    });

    if (res.ok) {
      router.push("/admin/references");
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">로딩 중...</div>;
  }

  if (!doc) {
    return <div className="text-center py-12 text-gray-400">문서를 찾을 수 없습니다</div>;
  }

  const statusColors: Record<string, string> = {
    pending: "bg-gray-100 text-gray-700",
    processing: "bg-yellow-100 text-yellow-700",
    completed: "bg-green-100 text-green-700",
    failed: "bg-red-100 text-red-700",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-400">
        <Link href="/admin/references" className="hover:text-gray-600">
          레퍼런스
        </Link>
        <span>/</span>
        <span className="text-gray-700">{doc.title}</span>
      </div>

      {/* 문서 정보 카드 */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{doc.title}</h1>
            <p className="text-sm text-gray-400 mt-1">{doc.file_name}</p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[doc.status] || ""}`}
          >
            {doc.status}
          </span>
        </div>

        <div className="grid grid-cols-4 gap-4 mt-6 text-sm">
          <div>
            <div className="text-gray-400">타입</div>
            <div className="font-medium mt-1">
              {doc.reference_type === "business_plan" ? "사업계획서" : "IR PPT"}
            </div>
          </div>
          <div>
            <div className="text-gray-400">템플릿 유형</div>
            <div className="font-medium mt-1">{doc.template_type}</div>
          </div>
          <div>
            <div className="text-gray-400">청크 수</div>
            <div className="font-medium mt-1">{doc.chunk_count}</div>
          </div>
          <div>
            <div className="text-gray-400">생성일</div>
            <div className="font-medium mt-1">
              {new Date(doc.created_at).toLocaleDateString("ko-KR")}
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleProcess}
            disabled={processing}
            className="h-9 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {processing ? "처리 중..." : doc.status === "completed" ? "재처리" : "처리 시작"}
          </button>
          <button
            onClick={handleDelete}
            className="h-9 px-4 rounded-lg border border-red-300 text-red-600 text-sm hover:bg-red-50"
          >
            삭제
          </button>
        </div>
      </div>

      {/* 처리 로그 */}
      {processLog.length > 0 && (
        <div className="bg-gray-900 rounded-xl p-4 mb-6 max-h-60 overflow-y-auto">
          {processLog.map((log, i) => (
            <div key={i} className="text-green-400 text-xs font-mono">
              {log}
            </div>
          ))}
        </div>
      )}

      {/* OCR 텍스트 */}
      {doc.ocr_text && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">OCR 텍스트</h2>
            <button
              onClick={() => setShowOcr(!showOcr)}
              className="text-sm text-blue-600 hover:underline"
            >
              {showOcr ? "접기" : "펼치기"} ({doc.ocr_text.length}자)
            </button>
          </div>
          {showOcr && (
            <pre className="text-xs text-gray-600 whitespace-pre-wrap max-h-96 overflow-y-auto bg-gray-50 rounded-lg p-4">
              {doc.ocr_text}
            </pre>
          )}
        </div>
      )}

      {/* 청크 목록 */}
      {chunks.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">
            청크 목록 ({chunks.length}개)
          </h2>
          <div className="space-y-3">
            {chunks.map((chunk) => (
              <div
                key={chunk.id}
                className="border border-gray-100 rounded-lg p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-gray-400">
                    #{chunk.chunk_index}
                  </span>
                  {chunk.section_name && (
                    <span className="text-xs bg-blue-50 text-blue-600 rounded px-1.5 py-0.5">
                      {chunk.section_name}
                    </span>
                  )}
                  <span className="text-xs text-gray-300">
                    {chunk.token_count} tokens
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-3">
                  {chunk.content}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
