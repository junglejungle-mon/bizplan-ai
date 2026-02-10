"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Send, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  { label: "전략 상담", prompt: "올해 우리 회사에 맞는 지원사업 전략을 짜주세요" },
  { label: "오늘 추천", prompt: "오늘 추천 지원사업을 알려주세요" },
  { label: "마감 임박", prompt: "마감이 임박한 지원사업이 있나요?" },
  { label: "사용법", prompt: "BizPlan AI 사용법을 알려주세요" },
];

export function AssistantCard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
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
        body: JSON.stringify({ message: msg, contextType: "general" }),
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
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
            <Sparkles className="h-4 w-4 text-blue-600" />
          </div>
          AI 사업 비서
          <span className="text-xs font-normal text-gray-400 ml-auto">
            무엇이든 물어보세요
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 빠른 질문 버튼 */}
        {!hasMessages && (
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((action, i) => (
              <button
                key={i}
                onClick={() => handleSend(action.prompt)}
                className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs text-blue-700 hover:bg-blue-100 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* 대화 영역 */}
        {hasMessages && (
          <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg bg-gray-50 p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-800 border border-gray-200"
                  }`}
                >
                  {msg.role === "user" ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  ) : (
                    <div className="text-sm prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-1">
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
                <div className="max-w-[85%] rounded-xl px-3 py-2 bg-white text-gray-800 border border-gray-200">
                  <div className="text-sm prose prose-sm max-w-none [&>p]:my-1 [&>ul]:my-1">
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
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* 입력 영역 */}
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
      </CardContent>
    </Card>
  );
}
