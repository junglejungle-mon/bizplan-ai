"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { INTERVIEW_INITIAL_QUESTION } from "@/lib/ai/prompts/interview";
import {
  MessageSquare,
  Send,
  Building2,
  CheckCircle2,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState<"company" | "interview" | "complete">("company");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [questionOrder, setQuestionOrder] = useState(0);
  const [profileScore, setProfileScore] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  // 회사 생성
  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("companies")
      .insert({
        user_id: user.id,
        name: companyName,
        business_content: "",
        profile_score: 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating company:", error);
      setLoading(false);
      return;
    }

    setCompanyId(data.id);
    setStep("interview");
    setMessages([{ role: "assistant", content: INTERVIEW_INITIAL_QUESTION }]);

    // 초기 질문 DB 저장
    await supabase.from("company_interviews").insert({
      company_id: data.id,
      question: INTERVIEW_INITIAL_QUESTION,
      category: "basic",
      question_order: 0,
      round: 1,
    });

    setLoading(false);
  };

  // 인터뷰 답변 전송
  const handleSendAnswer = async () => {
    if (!input.trim() || !companyId || loading) return;

    const answer = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: answer }]);
    setLoading(true);
    setStreamingText("");

    try {
      const response = await fetch("/api/company/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          answer,
          currentRound,
          questionOrder,
        }),
      });

      if (!response.ok) throw new Error("Interview API error");

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("text/event-stream")) {
        // SSE 스트리밍
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

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
              setStreamingText((prev) => prev + data.text);
            } else if (data.type === "done") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.question },
              ]);
              setStreamingText("");
              setQuestionOrder(data.questionOrder);

              // 라운드 체크 (4개 질문마다 라운드 변경)
              if (data.questionOrder % 4 === 0 && currentRound < 3) {
                setCurrentRound((r) => r + 1);
              }
            } else if (data.type === "error") {
              console.error("Stream error:", data.message);
            }
          }
        }
      } else {
        // JSON 응답 (완료)
        const data = await response.json();
        if (data.type === "complete") {
          setProfileScore(data.profileScore);
          setStep("complete");
        }
      }
    } catch (error) {
      console.error("Interview error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "죄송합니다, 오류가 발생했습니다. 다시 시도해 주세요.",
        },
      ]);
    }

    setLoading(false);
  };

  // 인터뷰 스킵
  const handleSkip = () => {
    router.push("/dashboard");
  };

  if (step === "company") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
        <Card className="w-full max-w-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mb-4">
              <Building2 className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">회사 정보 입력</h1>
            <p className="mt-2 text-gray-500">
              AI 인터뷰를 통해 정부지원사업에 최적화된 프로필을 만들어 드립니다
            </p>
          </div>

          <form onSubmit={handleCreateCompany} className="space-y-6">
            <Input
              id="companyName"
              label="회사명 (사업자명)"
              placeholder="주식회사 정글몬스터"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
            />
            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 생성 중...</>
              ) : (
                <>AI 인터뷰 시작하기 <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  if (step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
        <Card className="w-full max-w-lg p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">프로필 구축 완료!</h1>
          <p className="mt-2 text-gray-500">
            프로필 완성도: <span className="font-bold text-blue-600">{profileScore}%</span>
          </p>

          <div className="mt-6 h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
              style={{ width: `${profileScore}%` }}
            />
          </div>

          <p className="mt-4 text-sm text-gray-600">
            {profileScore >= 70
              ? "사업계획서 자동 작성이 가능합니다!"
              : "회사 정보에서 추가 인터뷰로 프로필을 더 고도화할 수 있습니다."}
          </p>

          <Button
            className="mt-8 gap-2"
            size="lg"
            onClick={() => router.push("/dashboard")}
          >
            대시보드로 이동 <ArrowRight className="h-4 w-4" />
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 채팅 영역 */}
      <div className="flex flex-1 flex-col">
        {/* 상단 바 */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900">AI 사업 분석 인터뷰</h2>
              <p className="text-xs text-gray-500">Round {currentRound}/3</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={currentRound === 1 ? "default" : "secondary"}>기본 정보</Badge>
            <Badge variant={currentRound === 2 ? "default" : "secondary"}>사업 심화</Badge>
            <Badge variant={currentRound === 3 ? "default" : "secondary"}>지원사업 최적화</Badge>
            <Button variant="ghost" size="sm" onClick={handleSkip}>
              건너뛰기
            </Button>
          </div>
        </div>

        {/* 채팅 메시지 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-white border border-gray-200 text-gray-800"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-white border border-gray-200 text-gray-800">
                <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
              </div>
            </div>
          )}

          {loading && !streamingText && (
            <div className="flex justify-start">
              <div className="rounded-2xl px-4 py-3 bg-white border border-gray-200">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t bg-white px-6 py-4">
          <div className="flex gap-3">
            <input
              type="text"
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="답변을 입력하세요..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAnswer();
                }
              }}
              disabled={loading}
            />
            <Button
              onClick={handleSendAnswer}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-12 w-12 rounded-xl"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* 우측 프로필 패널 */}
      <div className="hidden xl:flex xl:w-80 xl:flex-col xl:border-l xl:bg-white xl:p-6">
        <h3 className="font-semibold text-gray-900">프로필 완성도</h3>
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">현재 점수</span>
            <span className="font-bold text-blue-600">{profileScore}%</span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">기준</p>
          {[
            { label: "30% 미만", desc: "기본 정보만 — 매칭 부정확", color: "text-red-500" },
            { label: "30~70%", desc: "사업 방향 파악됨 — 매칭 가능", color: "text-yellow-500" },
            { label: "70%+", desc: "고도화 완료 — 계획서 자동작성 가능", color: "text-green-500" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`mt-1 h-2 w-2 rounded-full ${item.color.replace("text-", "bg-")}`} />
              <div>
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-xs text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg bg-blue-50 p-4">
          <p className="text-xs font-medium text-blue-800">진행 상황</p>
          <p className="mt-1 text-sm text-blue-700">
            Round {currentRound}/3 진행 중
          </p>
          <p className="mt-1 text-xs text-blue-600">
            {messages.filter((m) => m.role === "user").length}개 답변 완료
          </p>
        </div>
      </div>
    </div>
  );
}
