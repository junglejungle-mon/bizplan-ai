"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Presentation,
  Loader2,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

interface IRGeneratorClientProps {
  planId: string;
  planTitle: string;
  hasPresentation: boolean;
}

const TEMPLATES: { key: string; label: string }[] = [
  { key: "minimal", label: "미니멀" },
  { key: "tech", label: "테크" },
  { key: "classic", label: "클래식" },
];

export function IRGeneratorClient({
  planId,
  planTitle,
  hasPresentation,
}: IRGeneratorClientProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("minimal");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setError(null);
    setDone(false);

    try {
      const response = await fetch(`/api/plans/${planId}/ir/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: selectedTemplate }),
      });

      if (!response.ok) throw new Error("IR 생성 API 호출 실패");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (reader) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const event = JSON.parse(line.slice(6));
            switch (event.type) {
              case "progress":
                setProgress(event.data.progress || 0);
                setCurrentStep(event.data.step || "");
                break;
              case "slide_start":
                setProgress(event.data.progress || 0);
                setCurrentStep(
                  `${event.data.slideType || ""} 슬라이드 생성 중...`
                );
                break;
              case "slide_done":
                setProgress(event.data.progress || 0);
                break;
              case "complete":
                setProgress(100);
                setDone(true);
                setCurrentStep("완료!");
                setTimeout(() => {
                  router.refresh();
                }, 2000);
                break;
              case "error":
                setError(event.data.message || "알 수 없는 오류");
                setGenerating(false);
                break;
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(String(err));
      setGenerating(false);
    }
  };

  const handleDownloadPptx = async () => {
    setDownloading(true);
    try {
      const response = await fetch(`/api/plans/${planId}/ir/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pptx" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "다운로드 실패");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const disposition = response.headers.get("Content-Disposition");
      const filenameMatch = disposition?.match(/filename="(.+)"/);
      a.download = filenameMatch
        ? decodeURIComponent(filenameMatch[1])
        : "IR_PPT.pptx";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      alert(`다운로드 오류: ${err}`);
    }
    setDownloading(false);
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href={`/plans/${planId}`}
            className="text-gray-400 hover:text-gray-600"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900">IR PPT 편집기</h1>
            <p className="text-sm text-gray-500">{planTitle}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={handleDownloadPptx}
            disabled={!hasPresentation || downloading}
          >
            {downloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            PPTX 다운로드
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled
            title="PDF 내보내기는 곧 지원됩니다"
          >
            <Download className="h-4 w-4" /> PDF (준비중)
          </Button>
        </div>
      </div>

      {/* 생성 완료 */}
      {done && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-green-900">IR PPT 생성 완료!</h3>
            <p className="mt-2 text-sm text-green-700">
              PPTX 다운로드 버튼으로 다운로드하세요.
            </p>
            <p className="mt-1 text-xs text-green-600">
              잠시 후 페이지가 새로고침됩니다...
            </p>
          </CardContent>
        </Card>
      )}

      {/* 생성 진행 중 */}
      {generating && !done && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {currentStep || "준비 중..."}
                </p>
              </div>
              <span className="text-sm font-bold text-blue-600">
                {progress}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {/* 생성 시작 카드 */}
      {!generating && !done && (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <Presentation className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900">IR PPT 자동 생성</h3>
            <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
              사업계획서를 기반으로 투자유치용 IR PPT를 자동 생성합니다. 표지,
              문제정의, 솔루션, 시장규모, 비즈니스모델, 팀소개 등 10~15장의
              슬라이드가 생성됩니다.
            </p>
            <div className="mt-6 flex gap-3">
              {TEMPLATES.map((t) => (
                <Badge
                  key={t.key}
                  variant={
                    selectedTemplate === t.key ? "default" : "outline"
                  }
                  className={`cursor-pointer ${
                    selectedTemplate === t.key
                      ? "bg-blue-600"
                      : "hover:bg-blue-50"
                  }`}
                  onClick={() => setSelectedTemplate(t.key)}
                >
                  {t.label}
                </Badge>
              ))}
            </div>
            <Button className="mt-6 gap-2" onClick={handleGenerate}>
              <Presentation className="h-4 w-4" /> IR PPT 생성 시작
            </Button>
            {error && (
              <p className="mt-3 text-sm text-red-600">{error}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
