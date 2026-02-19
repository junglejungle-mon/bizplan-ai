"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Pencil, Check, X, MessageSquarePlus, Send, Wand2 } from "lucide-react";
import { SectionContent } from "./section-content";
import { InterleavedContent } from "./interleaved-content";

interface SectionCardProps {
  planId: string;
  section: {
    id: string;
    section_name: string;
    content: string | null;
    guidelines: string | null;
    section_order: number;
  };
  index: number;
}

export function SectionCard({ planId, section, index }: SectionCardProps) {
  const [regenerating, setRegenerating] = useState(false);
  const [streamContent, setStreamContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPromptInput, setShowPromptInput] = useState(false);
  const [userPrompt, setUserPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  // 편집 모드 진입 시 textarea 높이 자동 조절
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
      textareaRef.current.focus();
    }
  }, [editing]);

  // 자동저장 (2초 디바운스)
  const autoSave = useCallback(
    (content: string) => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        await saveContent(content);
      }, 2000);
    },
    [planId, section.id]
  );

  const saveContent = async (content: string) => {
    setSaving(true);
    try {
      const res = await fetch(
        `/api/plans/${planId}/sections/${section.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch (e) {
      setError("저장 실패");
    }
    setSaving(false);
  };

  const handleEditChange = (value: string) => {
    setEditContent(value);
    autoSave(value);
    // textarea 높이 자동 조절
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = textareaRef.current.scrollHeight + "px";
    }
  };

  const handleEditDone = async () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await saveContent(editContent);
    setEditing(false);
    router.refresh();
  };

  const handleEditCancel = () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setEditContent(section.content || "");
    setEditing(false);
  };

  const handleRegenerate = async (prompt?: string) => {
    setRegenerating(true);
    setStreamContent("");
    setError(null);
    setEditing(false);
    setShowPromptInput(false);

    try {
      const response = await fetch(
        `/api/plans/${planId}/sections/${section.id}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userPrompt: prompt || undefined }),
        }
      );

      if (!response.ok) throw new Error("재생성 API 호출 실패");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accContent = "";

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
              case "chunk":
                accContent += event.data.chunk || "";
                setStreamContent(accContent);
                break;
              case "complete":
                setRegenerating(false);
                setEditContent(accContent);
                router.refresh();
                break;
              case "error":
                setError(event.data.message || "알 수 없는 오류");
                setRegenerating(false);
                break;
            }
          } catch {}
        }
      }
    } catch (err) {
      setError(String(err));
      setRegenerating(false);
    }
  };

  const displayContent = regenerating && streamContent ? streamContent : section.content;

  return (
    <Card id={`section-${section.id}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm sm:text-base truncate">
          {index + 1}. {section.section_name}
        </CardTitle>
        <div className="flex items-center gap-1 shrink-0">
          {/* 저장 상태 표시 */}
          {saving && (
            <span className="text-xs text-gray-400 mr-2">저장 중...</span>
          )}
          {saved && (
            <span className="text-xs text-green-600 mr-2">저장됨</span>
          )}

          {editing ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-green-600 hover:text-green-700"
                onClick={handleEditDone}
              >
                <Check className="h-4 w-4" /> <span className="hidden sm:inline">완료</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-gray-500"
                onClick={handleEditCancel}
              >
                <X className="h-4 w-4" /> <span className="hidden sm:inline">취소</span>
              </Button>
            </>
          ) : (
            <>
              {displayContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs"
                  onClick={() => {
                    setEditContent(section.content || "");
                    setEditing(true);
                  }}
                  disabled={regenerating}
                >
                  <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">편집</span>
                </Button>
              )}
              {displayContent && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-xs text-indigo-600 hover:text-indigo-700"
                  onClick={() => {
                    setShowPromptInput(!showPromptInput);
                    setUserPrompt("");
                    setTimeout(() => promptInputRef.current?.focus(), 100);
                  }}
                  disabled={regenerating}
                >
                  <Wand2 className="h-4 w-4" />
                  <span className="hidden sm:inline">프롬프트 수정</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => handleRegenerate()}
                disabled={regenerating}
              >
                {regenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">{regenerating ? "생성 중..." : "AI 재생성"}</span>
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* 프롬프트 수정 입력 영역 */}
        {showPromptInput && !regenerating && (
          <div className="mb-4 rounded-lg border-2 border-indigo-200 bg-indigo-50/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquarePlus className="h-4 w-4 text-indigo-600" />
              <span className="text-xs font-semibold text-indigo-700">
                AI에게 수정 지시사항을 입력하세요
              </span>
            </div>
            <textarea
              ref={promptInputRef}
              className="w-full min-h-[80px] rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent resize-none placeholder:text-gray-400"
              value={userPrompt}
              onChange={(e) => setUserPrompt(e.target.value)}
              placeholder="예: 매출 수치를 더 구체적으로 작성해줘 / 경쟁사 비교표를 추가해줘 / 시장 규모 데이터를 최신 자료로 업데이트해줘"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && userPrompt.trim()) {
                  handleRegenerate(userPrompt.trim());
                }
              }}
            />
            <div className="flex items-center justify-between mt-2">
              <p className="text-[10px] text-gray-400">
                Cmd+Enter로 바로 실행
              </p>
              <div className="flex gap-1.5">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-gray-500 h-7 px-2"
                  onClick={() => {
                    setShowPromptInput(false);
                    setUserPrompt("");
                  }}
                >
                  취소
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white h-7 px-3"
                  onClick={() => handleRegenerate(userPrompt.trim())}
                  disabled={!userPrompt.trim()}
                >
                  <Send className="h-3 w-3" />
                  수정 재생성
                </Button>
              </div>
            </div>
            {/* 빠른 프롬프트 예시 칩 */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[
                "매출 수치 더 구체적으로",
                "경쟁사 비교표 추가",
                "시장 규모 데이터 보강",
                "리스크 분석 추가",
                "분량 늘려서 더 상세하게",
              ].map((chip) => (
                <button
                  key={chip}
                  className="text-[10px] px-2 py-1 rounded-full border border-indigo-200 text-indigo-600 hover:bg-indigo-100 transition-colors"
                  onClick={() => {
                    setUserPrompt(chip);
                    promptInputRef.current?.focus();
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        {editing ? (
          <textarea
            ref={textareaRef}
            className="w-full min-h-[200px] rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            value={editContent}
            onChange={(e) => handleEditChange(e.target.value)}
            placeholder="마크다운 형식으로 작성하세요..."
          />
        ) : displayContent ? (
          <InterleavedContent
            planId={planId}
            sectionId={section.id}
            sectionName={section.section_name}
            sectionContent={displayContent}
            sectionOrder={section.section_order}
            onClickEdit={() => {
              if (!regenerating) {
                setEditContent(section.content || "");
                setEditing(true);
              }
            }}
            regenerating={regenerating}
          />
        ) : (
          <p className="text-sm text-gray-400 italic">
            아직 생성되지 않았습니다
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}

        {section.guidelines && !editing && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500">
              <strong>작성 지침:</strong> {section.guidelines}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
