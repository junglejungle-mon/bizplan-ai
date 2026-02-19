"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Send,
  Loader2,
  ArrowRight,
  Search,
  FileText,
  Presentation,
  Target,
} from "lucide-react";
import { SamplePreview } from "@/components/dashboard/sample-preview";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ConsultantPageClientProps {
  companyName: string;
  profileScore: number;
  samplePlan: {
    title: string;
    companyName: string;
    sections: { section_name: string; content_preview: string; section_order: number }[];
  } | null;
  sampleIR: {
    title: string;
    template: string;
    slides: { slide_type: string; title: string }[];
  } | null;
}

const QUICK_PROMPTS = [
  { label: "계획서 작성 과정", prompt: "사업계획서 작성 과정을 단계별로 알려주세요" },
  { label: "지원사업 추천", prompt: "우리 회사에 맞는 지원사업을 추천해주세요" },
  { label: "IR PPT 안내", prompt: "IR PPT는 어떻게 만들어지나요? 과정을 알려주세요" },
  { label: "서류 준비 순서", prompt: "사업계획서 품질을 높이려면 어떤 서류를 먼저 준비해야 하나요?" },
  { label: "선정 전략", prompt: "정부지원사업 선정확률을 높이는 전략을 알려주세요" },
];

const PROCESS_STEPS = [
  {
    step: 1,
    label: "지원사업 선택",
    desc: "AI가 우리 회사에 맞는 지원사업을 자동 매칭합니다",
    icon: Search,
    color: "blue",
    href: "/programs",
  },
  {
    step: 2,
    label: "AI 사업계획서 작성",
    desc: "선택한 프로그램 양식에 맞춰 사업계획서를 자동 작성합니다",
    icon: FileText,
    color: "purple",
    href: "/plans",
  },
  {
    step: 3,
    label: "IR PPT 자동 생성",
    desc: "사업계획서 기반 투자유치 프레젠테이션을 자동 생성합니다",
    icon: Presentation,
    color: "orange",
    href: "/ir",
  },
];

export function ConsultantPageClient({
  companyName,
  profileScore,
  samplePlan,
  sampleIR,
}: ConsultantPageClientProps) {
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
        body: JSON.stringify({ message: msg, contextType: "consultant" }),
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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-blue-600" />
          AI 사업 컨설턴트
        </h1>
        <p className="mt-1 text-gray-500">
          {companyName}의 사업계획서 작성부터 지원사업 매칭까지 AI가 도와드립니다
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* 왼쪽: 채팅 영역 (3열) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-blue-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                </div>
                AI 상담
                <Badge className="ml-auto bg-green-100 text-green-700 text-[10px]">
                  실시간
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Quick Prompts */}
              {!hasMessages && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500">
                    궁금한 점을 물어보거나, 아래 버튼으로 바로 시작하세요
                  </p>
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
                </div>
              )}

              {/* 대화 영역 */}
              {hasMessages && (
                <div className="max-h-[500px] overflow-y-auto space-y-2 rounded-lg bg-gray-50 p-3">
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
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="사업계획서, 지원사업, IR PPT 등 무엇이든 물어보세요..."
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
                  className="h-10 w-10 rounded-xl"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 프로세스 안내 */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-600" />
                서비스 이용 프로세스
              </h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {PROCESS_STEPS.map((s) => {
                  const colors: Record<string, { bg: string; icon: string; text: string }> = {
                    blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
                    purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
                    orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-700" },
                  };
                  const c = colors[s.color];
                  return (
                    <Link key={s.step} href={s.href} className="flex-1">
                      <div className={`rounded-xl ${c.bg} p-4 hover:shadow-md transition-all cursor-pointer h-full`}>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-600">
                            {s.step}
                          </span>
                          <s.icon className={`h-4 w-4 ${c.icon}`} />
                        </div>
                        <p className={`text-sm font-semibold ${c.text}`}>{s.label}</p>
                        <p className="text-xs text-gray-500 mt-1">{s.desc}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 오른쪽: 결과물 예시 (2열) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="sticky top-20">
            {(samplePlan || sampleIR) ? (
              <SamplePreview samplePlan={samplePlan} sampleIR={sampleIR} />
            ) : (
              <Card className="border-purple-200">
                <CardContent className="p-6 text-center">
                  <FileText className="h-12 w-12 text-purple-300 mx-auto mb-3" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    결과물 예시 준비 중
                  </h3>
                  <p className="text-xs text-gray-500">
                    사업계획서와 IR PPT 예시가 곧 추가됩니다
                  </p>
                </CardContent>
              </Card>
            )}

            {/* 프로필 완성도 알림 */}
            {profileScore < 70 && (
              <Card className="border-blue-200 bg-blue-50 mt-4">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 flex-shrink-0">
                      <Target className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-blue-900">
                        프로필 완성도 {profileScore}%
                      </p>
                      <p className="text-[10px] text-blue-700">
                        70% 이상이면 사업계획서 자동 작성이 가능합니다
                      </p>
                    </div>
                    <Link href="/company">
                      <Button size="sm" variant="outline" className="text-xs h-7 gap-1">
                        완성 <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
