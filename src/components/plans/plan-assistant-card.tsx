"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Send,
  Loader2,
  Wand2,
  BarChart3,
  Target,
  FileSearch,
  TrendingUp,
  MessageSquarePlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface PlanAssistantCardProps {
  planId: string;
}

const QUICK_PROMPTS = [
  {
    icon: Wand2,
    label: "섹션 개선 제안",
    prompt:
      "현재 사업계획서의 각 섹션을 검토하고, 내용이 부족하거나 개선이 필요한 부분을 구체적으로 제안해줘. 특히 심사위원 관점에서 보완이 필요한 부분을 알려줘.",
    color: "text-indigo-600",
    bg: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100",
  },
  {
    icon: BarChart3,
    label: "인포그래픽 추천",
    prompt:
      "현재 사업계획서 내용을 분석해서, 어떤 섹션에 어떤 종류의 인포그래픽(차트, 그래프, 비교표 등)을 추가하면 좋을지 추천해줘. 시각화하면 설득력이 높아지는 데이터를 중심으로 알려줘.",
    color: "text-orange-600",
    bg: "bg-orange-50 border-orange-200 hover:bg-orange-100",
  },
  {
    icon: Target,
    label: "평가 기준 분석",
    prompt:
      "이 지원사업의 평가 기준을 분석하고, 현재 사업계획서가 각 평가 항목에 얼마나 잘 대응하고 있는지 점수와 함께 분석해줘. 점수를 높이려면 어떤 내용을 보강해야 할까?",
    color: "text-blue-600",
    bg: "bg-blue-50 border-blue-200 hover:bg-blue-100",
  },
  {
    icon: FileSearch,
    label: "시장조사 데이터 보강",
    prompt:
      "현재 사업계획서에 포함된 시장 데이터와 통계를 검토하고, 보강이 필요한 부분을 알려줘. 최신 시장 규모, 성장률, 경쟁 현황 데이터를 추가하면 좋을 항목들을 구체적으로 제안해줘.",
    color: "text-green-600",
    bg: "bg-green-50 border-green-200 hover:bg-green-100",
  },
  {
    icon: TrendingUp,
    label: "매출 수치 검증",
    prompt:
      "사업계획서의 매출 전망과 재무 수치를 검토해줘. 숫자의 근거가 타당한지, 시장 규모 대비 매출 목표가 현실적인지 분석하고, 심사위원이 납득할 수 있도록 수치를 보강할 방법을 제안해줘.",
    color: "text-purple-600",
    bg: "bg-purple-50 border-purple-200 hover:bg-purple-100",
  },
];

export function PlanAssistantCard({ planId }: PlanAssistantCardProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [expanded, setExpanded] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const handleSend = async (text?: string) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    setStreamingText("");

    try {
      const response = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          contextType: "plan",
          contextId: planId,
        }),
      });

      if (!response.ok) throw new Error("API error");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullResponse = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk") {
              fullResponse += data.text;
              setStreamingText(fullResponse);
            } else if (data.type === "done") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.content },
              ]);
              setStreamingText("");
            }
          } catch {}
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다, 오류가 발생했습니다." },
      ]);
      setStreamingText("");
    }

    setLoading(false);
  };

  const hasMessages = messages.length > 0 || streamingText;

  return (
    <Card className="border-indigo-200 overflow-hidden">
      <CardHeader className="pb-2">
        <button
          className="flex items-center justify-between w-full"
          onClick={() => setExpanded(!expanded)}
        >
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100">
              <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            </div>
            AI 계획서 어시스턴트
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-3 pt-0">
          {/* 빠른 질문 버튼 */}
          {!hasMessages && (
            <div className="space-y-1.5">
              <p className="text-[10px] text-gray-400 px-1">
                클릭하면 AI가 사업계획서를 분석합니다
              </p>
              {QUICK_PROMPTS.map((action, i) => {
                const Icon = action.icon;
                return (
                  <button
                    key={i}
                    onClick={() => handleSend(action.prompt)}
                    className={`flex items-center gap-2 w-full rounded-lg border px-3 py-2 text-xs font-medium transition-colors text-left ${action.bg} ${action.color}`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 대화 영역 */}
          {hasMessages && (
            <div className="max-h-80 overflow-y-auto space-y-2 rounded-lg bg-gray-50 p-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[90%] rounded-xl px-3 py-2 ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white"
                        : "bg-white text-gray-800 border border-gray-200"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <p className="text-xs whitespace-pre-wrap">
                        {msg.content}
                      </p>
                    ) : (
                      <div className="text-xs prose prose-xs max-w-none [&>p]:my-0.5 [&>ul]:my-0.5 [&>ol]:my-0.5 [&>h3]:text-xs [&>h3]:mt-1 [&>h3]:mb-0.5">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[90%] rounded-xl px-3 py-2 bg-white text-gray-800 border border-gray-200">
                    <div className="text-xs prose prose-xs max-w-none [&>p]:my-0.5 [&>ul]:my-0.5">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingText}
                      </ReactMarkdown>
                    </div>
                  </div>
                </div>
              )}

              {loading && !streamingText && (
                <div className="flex justify-start">
                  <div className="rounded-xl px-3 py-2 bg-white border border-gray-200">
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  </div>
                </div>
              )}

              <div ref={chatEndRef} />
            </div>
          )}

          {/* 대화 중일 때 빠른 추가 프롬프트 */}
          {hasMessages && !loading && (
            <div className="flex flex-wrap gap-1">
              {[
                { label: "인포그래픽 추천", icon: BarChart3 },
                { label: "프롬프트 수정", icon: Wand2 },
                { label: "수치 보강", icon: TrendingUp },
              ].map((chip) => {
                const Icon = chip.icon;
                return (
                  <button
                    key={chip.label}
                    className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    onClick={() => {
                      const promptMap: Record<string, string> = {
                        "인포그래픽 추천":
                          "이 사업계획서에 추가하면 좋을 인포그래픽과 차트를 추천해줘. 섹션별로 어떤 시각화가 효과적일지 알려줘.",
                        "프롬프트 수정":
                          "방금 분석한 내용을 바탕으로, 각 섹션을 수정할 때 사용할 수 있는 구체적인 프롬프트를 작성해줘. 복사해서 바로 사용할 수 있게 만들어줘.",
                        "수치 보강":
                          "사업계획서의 매출, 시장규모, 성장률 등 수치 데이터를 더 설득력 있게 보강하는 방법을 알려줘.",
                      };
                      handleSend(promptMap[chip.label] || chip.label);
                    }}
                  >
                    <Icon className="h-2.5 w-2.5" />
                    {chip.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* 입력 영역 */}
          <div className="flex gap-1.5">
            <input
              type="text"
              className="flex-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
              placeholder="질문을 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
            />
            <Button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-7 w-7 rounded-lg bg-indigo-600 hover:bg-indigo-700"
            >
              <Send className="h-3 w-3" />
            </Button>
          </div>

          {/* 하단 안내 */}
          <p className="text-[9px] text-gray-300 text-center">
            AI가 사업계획서 전체 맥락을 고려하여 답변합니다
          </p>
        </CardContent>
      )}
    </Card>
  );
}
