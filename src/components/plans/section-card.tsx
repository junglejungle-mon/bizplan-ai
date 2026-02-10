"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2, Pencil, Check, X } from "lucide-react";
import { SectionContent } from "./section-content";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  const handleRegenerate = async () => {
    setRegenerating(true);
    setStreamContent("");
    setError(null);
    setEditing(false);

    try {
      const response = await fetch(
        `/api/plans/${planId}/sections/${section.id}/regenerate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 text-xs"
                onClick={handleRegenerate}
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
        {editing ? (
          <textarea
            ref={textareaRef}
            className="w-full min-h-[200px] rounded-lg border border-gray-300 px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            value={editContent}
            onChange={(e) => handleEditChange(e.target.value)}
            placeholder="마크다운 형식으로 작성하세요..."
          />
        ) : displayContent ? (
          <div
            className="cursor-pointer hover:bg-gray-50 rounded-lg transition-colors -mx-2 px-2 py-1"
            onClick={() => {
              if (!regenerating) {
                setEditContent(section.content || "");
                setEditing(true);
              }
            }}
          >
            <SectionContent content={displayContent} />
          </div>
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
