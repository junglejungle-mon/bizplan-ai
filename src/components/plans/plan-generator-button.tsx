"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Sparkles, CheckCircle2 } from "lucide-react";

interface PlanGeneratorButtonProps {
  planId: string;
  hasContent: boolean;
  label?: string;
}

interface ProgressEvent {
  type: string;
  data: {
    step?: string;
    progress?: number;
    sectionName?: string;
    chunk?: string;
    totalSections?: number;
    planId?: string;
    message?: string;
  };
}

export function PlanGeneratorButton({ planId, hasContent, label }: PlanGeneratorButtonProps) {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [currentSection, setCurrentSection] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setError(null);
    setDone(false);

    try {
      const response = await fetch(`/api/plans/${planId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (!response.ok) throw new Error("생성 API 호출 실패");

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
            const event: ProgressEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case "progress":
                setProgress(event.data.progress || 0);
                setCurrentStep(event.data.step || "");
                break;
              case "section_start":
                setProgress(event.data.progress || 0);
                setCurrentSection(event.data.sectionName || "");
                setCurrentStep(`${event.data.sectionName} 작성 중...`);
                break;
              case "section_done":
                setProgress(event.data.progress || 0);
                break;
              case "complete":
                setProgress(100);
                setDone(true);
                setCurrentStep("완료!");
                // 2초 후 페이지 새로고침
                setTimeout(() => {
                  router.refresh();
                }, 2000);
                break;
              case "error":
                setError(event.data.message || "알 수 없는 오류");
                break;
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(String(err));
    }

    if (!done) {
      setGenerating(false);
      // 스트림이 끊겼지만 에러가 없으면 → 타임아웃 (이어쓰기 필요)
      if (!error && progress > 0 && progress < 100) {
        setCurrentStep("서버 연결이 끊겼습니다. 페이지를 새로고침하면 이어쓰기가 가능합니다.");
        setTimeout(() => {
          router.refresh();
        }, 3000);
      }
    }
  };

  if (done) {
    return (
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-6 text-center">
          <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto mb-3" />
          <h3 className="font-semibold text-green-900">생성 완료!</h3>
          <p className="mt-2 text-sm text-green-700">사업계획서가 성공적으로 생성되었습니다.</p>
          <p className="mt-1 text-xs text-green-600">잠시 후 페이지가 새로고침됩니다...</p>
        </CardContent>
      </Card>
    );
  }

  if (generating) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{currentStep || "준비 중..."}</p>
              {currentSection && (
                <p className="text-xs text-gray-500">{currentSection}</p>
              )}
            </div>
            <span className="text-sm font-bold text-blue-600">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-blue-600 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-600">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  if (hasContent && !label) {
    return null; // 이미 내용이 있고 label이 없으면 버튼 숨김
  }

  return (
    <Button className="gap-2" onClick={handleGenerate} size={label ? "sm" : "default"}>
      <Sparkles className="h-4 w-4" /> {label || "AI 자동 생성 시작"}
    </Button>
  );
}
