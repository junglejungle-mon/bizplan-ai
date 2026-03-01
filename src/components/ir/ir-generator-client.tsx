"use client";

import { useState, useRef, useEffect } from "react";
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
  Upload,
  Palette,
  FileDown,
} from "lucide-react";
import Link from "next/link";

interface SlideData {
  id: string;
  slide_order: number;
  slide_type: string;
  title: string;
  content: Record<string, unknown>;
  notes: string | null;
}

interface IRGeneratorClientProps {
  planId: string;
  planTitle: string;
  hasPresentation: boolean;
  slides?: SlideData[];
}

const TEMPLATES: { key: string; label: string; desc: string; colors: string[] }[] = [
  { key: "minimal", label: "미니멀", desc: "깔끔한 네이비 & 블루", colors: ["1A1A2E", "023793", "4361EE"] },
  { key: "tech", label: "테크", desc: "다크 배경 + 블루 액센트", colors: ["0D1117", "58A6FF", "7EE787"] },
  { key: "classic", label: "클래식", desc: "네이비 & 레드 포인트", colors: ["2C3E50", "003366", "E74C3C"] },
  { key: "professional", label: "프로페셔널", desc: "틸블루 & 골드 고급", colors: ["0F2B46", "1B4F72", "D4A843"] },
  { key: "vibrant", label: "바이브런트", desc: "퍼플 & 코랄 스타트업", colors: ["2D1B69", "6C3CE0", "FF6B6B"] },
];

const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "표지",
  problem: "문제 정의",
  solution: "솔루션",
  market: "시장 규모",
  business_model: "비즈니스 모델",
  traction: "트랙션/성과",
  competition: "경쟁 분석",
  tech: "기술/제품 차별성",
  team: "팀 소개",
  financials: "재무 계획",
  ask: "투자 요청",
  roadmap: "로드맵",
};

export function IRGeneratorClient({
  planId,
  planTitle,
  hasPresentation,
  slides = [],
}: IRGeneratorClientProps) {
  const [selectedTemplate, setSelectedTemplate] = useState("minimal");
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [brandColors, setBrandColors] = useState<{ primary: string; palette: string[] } | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // 저장된 브랜드 색상 로드 + 자동 CI 선택
  useEffect(() => {
    fetch("/api/company/brand-colors")
      .then((r) => r.json())
      .then((data) => {
        if (data.brandColors) {
          setBrandColors(data.brandColors);
          // 브랜드 색상이 있으면 자동으로 custom_ci 선택
          setSelectedTemplate("custom_ci");
        }
      })
      .catch(() => {});
  }, []);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("logo", file);

      const res = await fetch("/api/company/brand-colors", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.brandColors) {
        setBrandColors(data.brandColors);
      } else {
        alert(data.error || "색상 추출 실패");
      }
    } catch {
      alert("로고 업로드 오류");
    }
    setUploadingLogo(false);
    if (logoInputRef.current) logoInputRef.current.value = "";
  };

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
      const utf8Match = disposition?.match(/filename\*=UTF-8''(.+?)(?:;|$)/i);
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      a.download = utf8Match
        ? decodeURIComponent(utf8Match[1])
        : filenameMatch
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
            aria-label="사업계획서로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">IR PPT 생성기</h1>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50">Beta</Badge>
            </div>
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
              <FileDown className="h-4 w-4" />
            )}
            PPTX
          </Button>
        </div>
      </div>

      {/* 생성 완료 */}
      {done && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6 text-center">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-green-900">IR PPT 초안 생성 완료!</h3>
            <p className="mt-2 text-sm text-green-700">
              PPTX 다운로드 후 PowerPoint에서 디자인을 다듬어 사용하세요.
            </p>
            <p className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 inline-block">
              💡 AI가 생성한 초안입니다. 슬라이드 디자인은 편집 프로그램에서 보완을 권장합니다.
            </p>
            <p className="mt-3 text-xs text-green-600">
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

      {/* 슬라이드 목록 (프레젠테이션이 있을 경우) */}
      {!generating && !done && hasPresentation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              슬라이드 ({slides.length}장)
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleGenerate}
            >
              <Presentation className="h-4 w-4" /> 다시 생성
            </Button>
          </div>
          {slides.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-gray-500">
                <p>슬라이드가 없습니다. &quot;다시 생성&quot; 버튼을 클릭하세요.</p>
              </CardContent>
            </Card>
          )}
          <div className="grid gap-3">
            {slides.map((slide) => {
              const content = slide.content as Record<string, unknown>;
              const headline = (content?.headline as string) || "";
              const bullets = (content?.bullets as string[]) || [];
              return (
                <Card key={slide.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                        {slide.slide_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {SLIDE_TYPE_LABELS[slide.slide_type] || slide.slide_type}
                          </Badge>
                          <h3 className="font-medium text-gray-900 truncate">
                            {slide.title}
                          </h3>
                        </div>
                        {headline && (
                          <p className="text-sm text-gray-600 mb-1">{headline}</p>
                        )}
                        {bullets.length > 0 && (
                          <ul className="text-xs text-gray-500 space-y-0.5">
                            {bullets.slice(0, 3).map((b, i) => (
                              <li key={i} className="truncate">• {b}</li>
                            ))}
                            {bullets.length > 3 && (
                              <li className="text-gray-400">
                                +{bullets.length - 3}개 더...
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 생성 시작 카드 (프레젠테이션이 없을 경우) */}
      {!generating && !done && !hasPresentation && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Presentation className="h-16 w-16 text-gray-300 mb-4" />
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-gray-900">IR PPT 초안 생성</h3>
              <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 bg-amber-50">Beta</Badge>
            </div>
            <p className="mt-2 text-sm text-gray-500 text-center max-w-md">
              사업계획서를 기반으로 투자유치용 IR PPT 초안을 자동 생성합니다.
              AI가 콘텐츠를 구성하며, 다운로드 후 PowerPoint에서 디자인을 보완하여 사용하세요.
            </p>

            {/* 템플릿 선택 (카드 형태) */}
            <div className="mt-6 w-full max-w-xl">
              <p className="text-xs font-medium text-gray-500 mb-3 text-center">
                <Palette className="h-3 w-3 inline mr-1" />
                디자인 템플릿 선택
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    className={`relative rounded-lg border-2 p-3 text-left transition-all ${
                      selectedTemplate === t.key
                        ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200"
                        : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedTemplate(t.key)}
                  >
                    {/* 색상 미리보기 */}
                    <div className="flex gap-1 mb-2">
                      {t.colors.map((color, i) => (
                        <div
                          key={i}
                          className="h-4 w-4 rounded-full border border-gray-200"
                          style={{ backgroundColor: `#${color}` }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-semibold text-gray-900">{t.label}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>
                    {selectedTemplate === t.key && (
                      <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                ))}

                {/* CI 커스텀 옵션 */}
                <button
                  className={`relative rounded-lg border-2 border-dashed p-3 text-left transition-all ${
                    selectedTemplate === "custom_ci"
                      ? "border-purple-400 bg-purple-50 ring-1 ring-purple-200"
                      : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/50"
                  }`}
                  onClick={() => {
                    if (brandColors) {
                      setSelectedTemplate("custom_ci");
                    } else {
                      logoInputRef.current?.click();
                    }
                  }}
                >
                  {brandColors ? (
                    <>
                      <div className="flex gap-1 mb-2">
                        {brandColors.palette?.slice(0, 3).map((color: string, i: number) => (
                          <div
                            key={i}
                            className="h-4 w-4 rounded-full border border-gray-200"
                            style={{ backgroundColor: `#${color}` }}
                          />
                        ))}
                      </div>
                      <p className="text-xs font-semibold text-purple-700">우리 CI</p>
                      <p className="text-[10px] text-purple-500 mt-0.5">로고에서 추출한 색상</p>
                      {selectedTemplate === "custom_ci" && (
                        <div className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-purple-500 flex items-center justify-center">
                          <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center justify-center h-4 mb-2">
                        {uploadingLogo ? (
                          <Loader2 className="h-4 w-4 animate-spin text-purple-400" />
                        ) : (
                          <Upload className="h-4 w-4 text-purple-400" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-purple-600">
                        {uploadingLogo ? "분석 중..." : "로고 업로드"}
                      </p>
                      <p className="text-[10px] text-purple-400 mt-0.5">CI 색상 자동 추출</p>
                    </>
                  )}
                </button>
              </div>

              {/* 로고 변경 버튼 (이미 추출된 경우) */}
              {brandColors && (
                <div className="flex justify-center mt-2">
                  <button
                    className="text-[10px] text-purple-500 hover:text-purple-700 underline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    {uploadingLogo ? "분석 중..." : "로고 다시 업로드"}
                  </button>
                </div>
              )}

              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
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
