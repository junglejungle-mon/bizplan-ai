"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { INTERVIEW_INITIAL_QUESTION } from "@/lib/ai/prompts/interview";
import { CompanyStep } from "@/components/onboarding/company-step";
import { InterviewChat } from "@/components/onboarding/interview-chat";
import { AnalyzingStep } from "@/components/onboarding/analyzing-step";
import { CompleteStep } from "@/components/onboarding/complete-step";
import { TermsStep } from "@/components/onboarding/terms-step";
import { trackOnboardingStart, trackOnboardingRound, trackOnboardingComplete, trackOnboardingDrop } from "@/lib/analytics";

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

export default function OnboardingPageWrapper() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
          <div className="text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
            <p className="mt-3 text-sm text-gray-500">로딩 중...</p>
          </div>
        </div>
      }
    >
      <OnboardingPage />
    </Suspense>
  );
}

function OnboardingPage() {
  const [step, setStep] = useState<"terms" | "company" | "interview" | "analyzing" | "complete" | "loading">("loading");
  const [termsLoading, setTermsLoading] = useState(false);
  const searchParams = useSearchParams();
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
  const router = useRouter();

  // 기존 회사 + 인터뷰 데이터 확인 → 이어하기
  useEffect(() => {
    checkExistingProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 이탈 방지: 인터뷰 진행 중 탭/창 이탈 시 GA4 이벤트 + 경고
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (step === "interview" && currentRound < 5) {
        trackOnboardingDrop(currentRound, 5);
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [step, currentRound]);

  const checkExistingProgress = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setStep("company");
      return;
    }

    // OAuth 가입 후 약관 미동의 → 약관 동의 화면
    const requireTerms = searchParams.get("require_terms") === "true";
    if (requireTerms) {
      setStep("terms");
      return;
    }

    // 기존 회사 확인
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, profile_score, business_content")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (!companies || companies.length === 0) {
      // 회사 없음 → 처음부터
      setStep("company");
      return;
    }

    const existingCompany = companies[0];

    // 기존 인터뷰 데이터 확인
    const { data: interviewData } = await supabase
      .from("company_interviews")
      .select("question, answer, round, question_order")
      .eq("company_id", existingCompany.id)
      .order("question_order", { ascending: true });

    const answeredQA = (interviewData ?? []).filter(qa => qa.answer !== null);

    if (answeredQA.length > 0) {
      // 기존 인터뷰가 있음
      const lastQA = interviewData?.[interviewData.length - 1];
      const lastRound = lastQA?.round || 1;
      const lastOrder = lastQA?.question_order || 0;
      const allAnswered = interviewData?.every(qa => qa.answer !== null);

      setCompanyId(existingCompany.id);
      setProfileScore(existingCompany.profile_score || 0);

      // 대화 복원 (많으면 최근 8개만)
      const qaToRestore = (interviewData ?? []).length > 8
        ? (interviewData ?? []).slice(-8)
        : (interviewData ?? []);

      const restoredMessages: ChatMessage[] = [];

      // 이미 완료된 상태면 안내 메시지 추가
      if (lastRound >= 5 && allAnswered && existingCompany.business_content) {
        restoredMessages.push({
          role: "system",
          content: `✅ 기존 인터뷰 완료 (프로필 ${existingCompany.profile_score}%). 추가 질문으로 프로필을 고도화합니다.`,
        });
      }

      for (const qa of qaToRestore) {
        restoredMessages.push({ role: "assistant", content: qa.question });
        if (qa.answer) {
          restoredMessages.push({ role: "user", content: qa.answer });
        }
      }

      setMessages(restoredMessages);
      setCurrentRound(lastRound);
      setQuestionOrder(lastOrder);
      setCollectedDataCount(answeredQA.length);
      setStep("interview");

      // 모든 질문에 답변 완료인데 다음 질문이 없는 경우 → 자동 요청
      if (allAnswered) {
        setTimeout(() => {
          requestNextQuestion(existingCompany.id, lastRound, lastOrder);
        }, 500);
      }
    } else if (interviewData && interviewData.length > 0) {
      // 초기 질문만 있고 답변 없음 → 인터뷰 처음부터 시작
      setCompanyId(existingCompany.id);
      setProfileScore(existingCompany.profile_score || 0);
      setMessages([{ role: "assistant", content: interviewData[0].question }]);
      setStep("interview");
    } else {
      // 회사만 있고 인터뷰 없음 → company step 표시하되 이름 프리필
      setStep("company");
    }
  };

  // 약관 동의 처리 (OAuth 사용자)
  const handleTermsAgree = async () => {
    setTermsLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      await supabase
        .from("profiles")
        .update({
          agreed_terms_at: new Date().toISOString(),
          agreed_privacy_at: new Date().toISOString(),
          terms_version: "2026-02-13",
          privacy_version: "2026-02-13",
        })
        .eq("id", user.id);

      setStep("company");
    } catch (error) {
      console.error("Terms agreement error:", error);
      alert("약관 동의 처리 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
    setTermsLoading(false);
  };

  // 회사 생성 완료 → 인터뷰 시작 + 간편 매칭 백그라운드 실행
  const handleCompanyComplete = (newCompanyId: string) => {
    setCompanyId(newCompanyId);
    trackOnboardingStart();
    setStep("interview");
    setMessages([{ role: "assistant", content: INTERVIEW_INITIAL_QUESTION }]);

    // 간편 매칭 백그라운드 실행 (인터뷰 시작과 동시에)
    fetch("/api/matching/quick", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ companyId: newCompanyId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.matched > 0) {
          // 간편 매칭 완료 (data.matched건)
        }
      })
      .catch((err) => {
        console.error("[QuickMatch] 간편 매칭 실패:", err);
      });
  };

  // 다음 질문 자동 요청 (복원 시 교착 상태 해결)
  const requestNextQuestion = async (cId: string, round: number, order: number) => {
    setLoading(true);
    setStreamingText("");
    try {
      const response = await fetch("/api/company/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: cId,
          answer: null,
          currentRound: round,
          questionOrder: order,
        }),
      });

      if (!response.ok) throw new Error("Interview API error");

      const contentType = response.headers.get("content-type");

      if (contentType?.includes("text/event-stream")) {
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
              setCurrentRound(data.round);
            }
          }
        }
      } else {
        const data = await response.json();
        if (data.type === "interview_complete") {
          trackOnboardingComplete(5);
          setStep("analyzing");
          setAnalysisProgress(5);
          setAnalysisStep("분석 준비 중...");
          fetchInsights(data.companyId);
        }
      }
    } catch (error) {
      console.error("Auto-question request error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "질문을 불러오는 중 오류가 발생했습니다. 페이지를 새로고침해 주세요.",
        },
      ]);
    }
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
              trackOnboardingRound(data.round, 5);
              setRoundTransitionData(data.summary);
              setShowRoundTransition(true);
              setProfileScore(data.interimScore || 0);
              setCollectedDataCount((prev) => prev + (data.summary?.collected_data?.length || 0));

              const roundLabels = ["", "사업 핵심", "기술/제품", "팀/실적", "성장 전략", "지원 최적화"];
              setMessages((prev) => [
                ...prev,
                {
                  role: "system",
                  content: `✅ Round ${data.round} (${roundLabels[data.round]}) 완료! 프로필 ${data.interimScore}%\n\n📊 확보 데이터: ${data.summary?.collected_data?.slice(0, 3).join(", ") || ""}\n\n➡️ Round ${data.nextRound} (${roundLabels[data.nextRound]}) 시작합니다.`,
                },
              ]);

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
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: `AI 서비스에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요. (${data.message || "알 수 없는 오류"})`,
                },
              ]);
              setStreamingText("");
            }
          }
        }
      } else {
        // JSON 응답 (인터뷰 완료 → 인사이트 추출)
        const data = await response.json();
        if (data.type === "interview_complete") {
          trackOnboardingComplete(5);
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

  // 인터뷰 리셋
  const handleReset = async () => {
    if (!companyId) return;
    if (!confirm("인터뷰를 처음부터 다시 시작하시겠습니까?\n기존 대화 내용이 모두 삭제됩니다.")) return;

    try {
      const res = await fetch("/api/company/interview/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });

      if (!res.ok) throw new Error("리셋 실패");

      setMessages([{ role: "assistant", content: INTERVIEW_INITIAL_QUESTION }]);
      setCurrentRound(1);
      setQuestionOrder(0);
      setProfileScore(0);
      setCollectedDataCount(0);
      setStreamingText("");
      setShowRoundTransition(false);
      setRoundTransitionData(null);
    } catch {
      alert("리셋 중 오류가 발생했습니다. 다시 시도해 주세요.");
    }
  };

  // 인사이트 추출 (인터뷰 완료 후)
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
          } catch (parseErr) {
            console.warn("[Insights] SSE 파싱 실패:", parseErr);
          }
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

  // 로딩 중 (기존 데이터 확인)
  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">인터뷰 진행 상태 확인 중...</p>
        </div>
      </div>
    );
  }

  // Step 0: 약관 동의 (OAuth 사용자)
  if (step === "terms") {
    return <TermsStep onAgree={handleTermsAgree} loading={termsLoading} />;
  }

  // Step 1: 회사 생성
  if (step === "company") {
    return <CompanyStep onComplete={handleCompanyComplete} />;
  }

  // Step 2.5: 분석 중
  if (step === "analyzing") {
    return <AnalyzingStep progress={analysisProgress} step={analysisStep} />;
  }

  // Step 3: 완료
  if (step === "complete") {
    return (
      <CompleteStep
        profileScore={profileScore}
        scoreBreakdown={scoreBreakdown}
        missingData={missingData}
      />
    );
  }

  // 파일 분석 완료 콜백 — 분석 결과를 system 메시지로 삽입
  const handleFileAnalyzed = (summary: string) => {
    setMessages((prev) => [...prev, { role: "system", content: summary }]);
  };

  // Step 2: 인터뷰 채팅
  return (
    <InterviewChat
      messages={messages}
      input={input}
      onInputChange={setInput}
      onSend={handleSendAnswer}
      onSkip={handleSkip}
      loading={loading}
      streamingText={streamingText}
      currentRound={currentRound}
      profileScore={profileScore}
      collectedDataCount={collectedDataCount}
      showRoundTransition={showRoundTransition}
      roundTransitionData={roundTransitionData}
      onFileAnalyzed={handleFileAnalyzed}
      onReset={handleReset}
    />
  );
}
