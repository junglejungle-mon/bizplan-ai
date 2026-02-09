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
  TrendingUp,
  Database,
  Target,
  Users,
  Briefcase,
  Shield,
} from "lucide-react";

interface ChatMessage {
  role: "assistant" | "user" | "system";
  content: string;
}

interface RoundSummary {
  collected_data: string[];
  data_quality: string;
  missing_for_plan: string[];
  strategic_insights: string[];
  interim_score: number;
}

const ROUND_CONFIG = [
  { num: 1, label: "사업 핵심", icon: Target, color: "blue" },
  { num: 2, label: "기술/제품", icon: Database, color: "purple" },
  { num: 3, label: "팀/실적", icon: Users, color: "green" },
  { num: 4, label: "성장 전략", icon: TrendingUp, color: "orange" },
  { num: 5, label: "지원 최적화", icon: Shield, color: "red" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState<"company" | "interview" | "analyzing" | "complete">("company");
  const [companyName, setCompanyName] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentRound, setCurrentRound] = useState(1);
  const [questionOrder, setQuestionOrder] = useState(0);
  const [profileScore, setProfileScore] = useState(0);
  const [streamingText, setStreamingText] = useState("");
  const [scoreBreakdown, setScoreBreakdown] = useState<Record<string, number> | null>(null);
  const [missingData, setMissingData] = useState<string[]>([]);
  const [collectedDataCount, setCollectedDataCount] = useState(0);
  const [showRoundTransition, setShowRoundTransition] = useState(false);
  const [roundTransitionData, setRoundTransitionData] = useState<RoundSummary | null>(null);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState("");
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
            } else if (data.type === "round_complete") {
              // 라운드 전환 효과
              setRoundTransitionData(data.summary);
              setShowRoundTransition(true);
              setProfileScore(data.interimScore || 0);
              setCollectedDataCount((prev) => prev + (data.summary?.collected_data?.length || 0));

              // 라운드 전환 메시지 추가
              const roundLabels = ["", "사업 핵심", "기술/제품", "팀/실적", "성장 전략", "지원 최적화"];
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content: `✅ Round ${data.round} (${roundLabels[data.round]}) 완료! 프로필 ${data.interimScore}%\n\n📊 확보 데이터: ${data.summary?.collected_data?.slice(0, 3).join(", ") || ""}\n\n➡️ Round ${data.nextRound} (${roundLabels[data.nextRound]}) 시작합니다.`,
                },
              ]);

              // 3초 후 전환 효과 닫기
              setTimeout(() => setShowRoundTransition(false), 3000);
            } else if (data.type === "done") {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: data.question },
              ]);
              setStreamingText("");
              setQuestionOrder(data.questionOrder);
              setCurrentRound(data.round);
            } else if (data.type === "error") {
              console.error("Stream error:", data.message);
            }
          }
        }
      } else {
        // JSON 응답 (인터뷰 완료 → 인사이트 추출 시작)
        const data = await response.json();
        if (data.type === "interview_complete") {
          setStep("analyzing");
          setAnalysisProgress(5);
          setAnalysisStep("분석 준비 중...");
          fetchInsights(data.companyId);
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

  // 인사이트 추출 (인터뷰 완료 후 별도 API 호출)
  const fetchInsights = async (targetCompanyId: string) => {
    try {
      const response = await fetch("/api/company/interview/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: targetCompanyId }),
      });

      if (!response.ok) throw new Error("Insights API error");

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
          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "progress" || data.type === "insights_extracted" || data.type === "content_generated") {
              setAnalysisProgress(data.progress || 0);
              setAnalysisStep(data.step || "");
            } else if (data.type === "complete") {
              setAnalysisProgress(100);
              setAnalysisStep("완료!");
              setProfileScore(data.profileScore);
              setScoreBreakdown(data.scoreBreakdown);
              setMissingData(data.missingData || []);
              // 1.5초 후 완료 화면으로 전환
              setTimeout(() => {
                setStep("complete");
              }, 1500);
            } else if (data.type === "error") {
              console.error("[Insights] Error:", data.message);
              setAnalysisStep("오류가 발생했습니다. 대시보드로 이동합니다...");
              setTimeout(() => {
                router.push("/dashboard");
              }, 3000);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error("Insights fetch error:", error);
      setAnalysisStep("분석 중 오류가 발생했습니다.");
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    }
  };

  // ========================================
  // Step 1: 회사 생성
  // ========================================
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
              AI 전략 컨설턴트가 사업을 분석하고, 정부지원사업에 최적화된 프로필을 구축합니다
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

            <div className="rounded-lg bg-blue-50 p-4 space-y-2">
              <p className="text-xs font-medium text-blue-800">AI 인터뷰 안내</p>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• 5라운드, 약 15~20개 질문 (10분 소요)</li>
                <li>• 시장 트렌드 기반 전략 컨설팅 + 데이터 수집</li>
                <li>• 인터뷰 완료 후 AI가 사업계획서를 자동 작성합니다</li>
              </ul>
            </div>

            <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> 생성 중...</>
              ) : (
                <>AI 전략 인터뷰 시작하기 <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // ========================================
  // Step 2.5: 분석 중 화면
  // ========================================
  if (step === "analyzing") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
        <Card className="w-full max-w-lg p-8">
          <div className="text-center mb-8">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 mb-6">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">사업 프로필 분석 중</h1>
            <p className="mt-2 text-gray-500">
              AI가 인터뷰 데이터를 분석하여 사업 프로필을 구축하고 있습니다
            </p>
          </div>

          {/* 진행률 바 */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-gray-600">{analysisStep || "준비 중..."}</span>
              <span className="font-bold text-blue-600">{analysisProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
                style={{ width: `${analysisProgress}%` }}
              />
            </div>
          </div>

          {/* 단계 표시 */}
          <div className="space-y-3 mt-6">
            {[
              { label: "인사이트 추출", threshold: 10 },
              { label: "사업 프로필 구축", threshold: 50 },
              { label: "데이터 저장", threshold: 80 },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs ${
                  analysisProgress >= item.threshold + 40
                    ? "bg-green-100 text-green-600"
                    : analysisProgress >= item.threshold
                    ? "bg-blue-100 text-blue-600"
                    : "bg-gray-100 text-gray-400"
                }`}>
                  {analysisProgress >= item.threshold + 40 ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : analysisProgress >= item.threshold ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>
                <span className={`text-sm ${
                  analysisProgress >= item.threshold
                    ? "text-gray-900 font-medium"
                    : "text-gray-400"
                }`}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-6 text-xs text-gray-400 text-center">
            약 30~60초 소요됩니다. 잠시만 기다려 주세요.
          </p>
        </Card>
      </div>
    );
  }

  // ========================================
  // Step 3: 완료 화면 (상세 분석 결과)
  // ========================================
  if (step === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
        <Card className="w-full max-w-2xl p-8">
          <div className="text-center mb-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">사업 프로필 구축 완료!</h1>
            <p className="mt-2 text-gray-500">
              프로필 완성도: <span className="font-bold text-blue-600">{profileScore}%</span>
            </p>
          </div>

          {/* 점수 바 */}
          <div className="h-3 rounded-full bg-gray-100 mb-6">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 transition-all duration-1000"
              style={{ width: `${profileScore}%` }}
            />
          </div>

          {/* 점수 분석 */}
          {scoreBreakdown && (
            <div className="grid grid-cols-5 gap-2 mb-6">
              {Object.entries(scoreBreakdown).map(([key, value]) => {
                const labels: Record<string, string> = {
                  data_completeness: "데이터",
                  strategic_clarity: "전략",
                  evidence_strength: "에비던스",
                  market_understanding: "시장",
                  team_capability: "팀역량",
                };
                return (
                  <div key={key} className="text-center p-2 rounded-lg bg-gray-50">
                    <p className="text-lg font-bold text-blue-600">{value}</p>
                    <p className="text-xs text-gray-500">{labels[key] || key}</p>
                  </div>
                );
              })}
            </div>
          )}

          {/* 결과 요약 */}
          <div className="space-y-4 mb-6">
            <p className="text-sm text-gray-600">
              {profileScore >= 80
                ? "🎉 충분한 데이터가 확보되었습니다! 고품질 사업계획서를 자동 작성할 수 있습니다."
                : profileScore >= 60
                ? "✅ 기본 사업계획서 작성이 가능합니다. 회사 정보에서 추가 인터뷰로 품질을 더 높일 수 있습니다."
                : "⚠️ 일부 데이터가 부족합니다. 회사 정보에서 추가 인터뷰를 진행하면 사업계획서 품질이 향상됩니다."}
            </p>

            {/* 부족한 데이터 */}
            {missingData.length > 0 && (
              <div className="rounded-lg bg-yellow-50 p-4">
                <p className="text-xs font-medium text-yellow-800 mb-2">📋 보완하면 좋을 데이터</p>
                <ul className="text-xs text-yellow-700 space-y-1">
                  {missingData.slice(0, 5).map((item, i) => (
                    <li key={i}>• {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 gap-2"
              size="lg"
              onClick={() => router.push("/dashboard")}
            >
              대시보드로 이동 <ArrowRight className="h-4 w-4" />
            </Button>
            {profileScore < 80 && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => router.push("/company")}
              >
                추가 인터뷰
              </Button>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // ========================================
  // Step 2: 인터뷰 채팅
  // ========================================
  const answeredCount = messages.filter((m) => m.role === "user").length;
  const totalQuestions = 20; // 5라운드 × 4개

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 채팅 영역 */}
      <div className="flex flex-1 flex-col">
        {/* 상단 바 */}
        <div className="flex items-center justify-between border-b bg-white px-6 py-3">
          <div className="flex items-center gap-3">
            <MessageSquare className="h-5 w-5 text-blue-600" />
            <div>
              <h2 className="font-semibold text-gray-900 text-sm">AI 사업 전략 인터뷰</h2>
              <p className="text-xs text-gray-500">
                {answeredCount}/{totalQuestions} 질문 완료
              </p>
            </div>
          </div>

          {/* 라운드 인디케이터 */}
          <div className="flex items-center gap-1.5">
            {ROUND_CONFIG.map((rc) => {
              const Icon = rc.icon;
              const isActive = currentRound === rc.num;
              const isDone = currentRound > rc.num;
              return (
                <div
                  key={rc.num}
                  className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all ${
                    isActive
                      ? "bg-blue-100 text-blue-700 font-medium"
                      : isDone
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {isDone ? (
                    <CheckCircle2 className="h-3 w-3" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{rc.label}</span>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={handleSkip} className="ml-2 text-xs">
              건너뛰기
            </Button>
          </div>
        </div>

        {/* 라운드 전환 배너 */}
        {showRoundTransition && roundTransitionData && (
          <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white px-6 py-3 animate-pulse">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  ✨ Round {currentRound} 시작!
                </p>
                <p className="text-xs opacity-80">
                  확보 데이터: {roundTransitionData.collected_data?.length || 0}개 |
                  프로필: {profileScore}%
                </p>
              </div>
              <Badge className="bg-white/20 text-white border-0">
                {ROUND_CONFIG[currentRound - 1]?.label || ""}
              </Badge>
            </div>
          </div>
        )}

        {/* 채팅 메시지 */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${
                msg.role === "user"
                  ? "justify-end"
                  : msg.role === "system"
                  ? "justify-center"
                  : "justify-start"
              }`}
            >
              {msg.role === "system" ? (
                <div className="max-w-[90%] rounded-xl px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 text-gray-700">
                  <p className="text-xs whitespace-pre-wrap">{msg.content}</p>
                </div>
              ) : (
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-gray-200 text-gray-800"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              )}
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
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  <span className="text-xs text-gray-500">AI가 분석하고 있습니다...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="border-t bg-white px-6 py-4">
          <div className="flex gap-3">
            <textarea
              className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              placeholder="답변을 입력하세요... (Enter로 전송, Shift+Enter로 줄바꿈)"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendAnswer();
                }
              }}
              disabled={loading}
              rows={2}
            />
            <Button
              onClick={handleSendAnswer}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-12 w-12 rounded-xl self-end"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-gray-400 text-center">
            💡 모르는 질문은 "잘 모르겠어요" 라고 답해도 괜찮습니다. AI가 추정치로 보완합니다.
          </p>
        </div>
      </div>

      {/* 우측 프로필 패널 */}
      <div className="hidden xl:flex xl:w-80 xl:flex-col xl:border-l xl:bg-white xl:p-6 xl:overflow-y-auto">
        <h3 className="font-semibold text-gray-900 mb-4">프로필 구축 현황</h3>

        {/* 점수 */}
        <div className="mb-6">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">프로필 완성도</span>
            <span className="font-bold text-blue-600">{profileScore}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-700"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </div>

        {/* 진행 상황 */}
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">라운드 진행</p>
          <div className="space-y-2">
            {ROUND_CONFIG.map((rc) => {
              const Icon = rc.icon;
              const isActive = currentRound === rc.num;
              const isDone = currentRound > rc.num;
              return (
                <div
                  key={rc.num}
                  className={`flex items-center gap-3 p-2 rounded-lg ${
                    isActive
                      ? "bg-blue-50 border border-blue-200"
                      : isDone
                      ? "bg-green-50"
                      : "opacity-50"
                  }`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                    isDone
                      ? "bg-green-100 text-green-600"
                      : isActive
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-400"
                  }`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div>
                    <p className={`text-xs font-medium ${isActive ? "text-blue-700" : isDone ? "text-green-700" : "text-gray-500"}`}>
                      R{rc.num}. {rc.label}
                    </p>
                    {isActive && (
                      <p className="text-[10px] text-blue-500">진행 중...</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 데이터 수집 현황 */}
        <div className="mb-6">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">수집 통계</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-blue-50 p-3 text-center">
              <p className="text-lg font-bold text-blue-600">{answeredCount}</p>
              <p className="text-[10px] text-blue-500">답변 완료</p>
            </div>
            <div className="rounded-lg bg-green-50 p-3 text-center">
              <p className="text-lg font-bold text-green-600">{collectedDataCount}</p>
              <p className="text-[10px] text-green-500">확보 데이터</p>
            </div>
          </div>
        </div>

        {/* 기준 안내 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">사업계획서 품질 기준</p>
          {[
            { label: "80%+", desc: "고품질 사업계획서 자동작성", color: "bg-green-500" },
            { label: "60~79%", desc: "기본 사업계획서 작성 가능", color: "bg-yellow-500" },
            { label: "60% 미만", desc: "추가 인터뷰 필요", color: "bg-red-500" },
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className={`mt-1.5 h-2 w-2 rounded-full ${item.color}`} />
              <div>
                <p className="text-xs font-medium text-gray-700">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* AI 인사이트 */}
        <div className="mt-6 rounded-lg bg-gradient-to-br from-indigo-50 to-blue-50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Briefcase className="h-4 w-4 text-indigo-600" />
            <p className="text-xs font-medium text-indigo-800">AI 전략 코칭</p>
          </div>
          <p className="text-xs text-indigo-700">
            {currentRound <= 2
              ? "시장 트렌드와 사업 핵심을 파악하고 있습니다. 수치와 데이터를 최대한 구체적으로 답변해 주세요."
              : currentRound <= 4
              ? "사업의 실행력과 성장 가능성을 확인하고 있습니다. 에비던스(실적, 인증, 투자)가 핵심입니다."
              : "마무리 단계입니다. 사회적 가치와 지원사업 적합성을 최적화하고 있습니다."}
          </p>
        </div>
      </div>
    </div>
  );
}
