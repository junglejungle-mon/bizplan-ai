"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, Loader2 } from "lucide-react";
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
  const router = useRouter();

  const handleRegenerate = async () => {
    setRegenerating(true);
    setStreamContent("");
    setError(null);

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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {index + 1}. {section.section_name}
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-xs"
          onClick={handleRegenerate}
          disabled={regenerating}
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          {regenerating ? "재생성 중..." : "AI 재생성"}
        </Button>
      </CardHeader>
      <CardContent>
        {displayContent ? (
          <SectionContent content={displayContent} />
        ) : (
          <p className="text-sm text-gray-400 italic">
            아직 생성되지 않았습니다
          </p>
        )}
        {error && (
          <p className="mt-2 text-sm text-red-600">{error}</p>
        )}
        {section.guidelines && (
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
