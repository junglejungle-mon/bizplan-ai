"use client";

import { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  X,
  Send,
  Loader2,
  Sparkles,
} from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_ACTIONS: Record<string, Array<{ label: string; prompt: string }>> = {
  "/programs": [
    { label: "오늘 추천", prompt: "오늘 추천 지원사업을 알려주세요" },
    { label: "마감 임박", prompt: "마감이 임박한 지원사업이 있나요?" },
  ],
  "/plans": [
    { label: "섹션 개선", prompt: "이 사업계획서에서 개선할 부분이 있나요?" },
    { label: "전체 검토", prompt: "사업계획서 전체를 검토해주세요" },
  ],
  default: [
    { label: "전략 상담", prompt: "올해 우리 회사에 맞는 지원사업 전략을 짜주세요" },
    { label: "사용법", prompt: "BizPlan AI 사용법을 알려주세요" },
  ],
};

export function AssistantBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  const quickActions =
    QUICK_ACTIONS[pathname] || QUICK_ACTIONS.default;

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
          contextType: pathname.startsWith("/programs")
            ? "program"
            : pathname.startsWith("/plans")
            ? "plan"
            : "general",
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

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-all hover:scale-105"
      >
        <Sparkles className="h-6 w-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex w-96 flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl" style={{ height: "520px" }}>
      {/* 헤더 */}
      <div className="flex items-center justify-between rounded-t-2xl bg-blue-600 px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-white" />
          <span className="font-medium text-white">AI 사업 비서</span>
        </div>
        <button onClick={() => setIsOpen(false)}>
          <X className="h-5 w-5 text-white/80 hover:text-white" />
        </button>
      </div>

      {/* 메시지 영역 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !streamingText && (
          <div className="text-center py-8">
            <Sparkles className="h-8 w-8 text-blue-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              무엇이든 물어보세요!
            </p>
            <div className="mt-4 flex flex-wrap gap-2 justify-center">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.prompt)}
                  className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {streamingText && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl px-3 py-2 bg-gray-100 text-gray-800">
              <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
            </div>
          </div>
        )}

        {loading && !streamingText && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-3 py-2 bg-gray-100">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* 입력 영역 */}
      <div className="border-t px-3 py-2">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            className="h-9 w-9 rounded-xl"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
