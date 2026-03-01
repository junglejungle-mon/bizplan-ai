import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamClaude, callClaude } from "@/lib/ai/claude";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildNextQuestionPrompt,
  buildRoundSummaryPrompt,
} from "@/lib/ai/prompts/interview";
import { calculateProfileScore } from "@/lib/utils/profile-score";
import { safeErrorMessage } from "@/lib/api/error";

// Vercel 타임아웃 확장
export const maxDuration = 60;

/**
 * POST /api/company/interview
 * AI 인터뷰 — v2: 5라운드 시스템, 로우데이터 확보 + 전략적 방향 유도
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId, answer, currentRound, questionOrder } = await request.json();

  // 회사 정보 가져오기 (전략 유도 + 점수 계산에 활용)
  const { data: company } = await supabase
    .from("companies")
    .select("name, industry, region, employee_count, revenue, established_date, business_content, profile_score")
    .eq("id", companyId)
    .single();

  // 이전 Q&A 가져오기
  const { data: previousQA } = await supabase
    .from("company_interviews")
    .select("question, answer, round, question_order")
    .eq("company_id", companyId)
    .order("question_order", { ascending: true });

  // 서류 업로드 현황 (서류 유도용 + 분석 데이터 활용)
  const { data: documents } = await supabase
    .from("company_documents")
    .select("document_type, status, extracted_data")
    .eq("company_id", companyId);

  const extractedDocs = (documents ?? []).filter((d) => d.status === "extracted");

  // 업로드된 파일의 분석 요약을 모아서 프롬프트에 반영
  const fileAnalysisSummaries = extractedDocs
    .filter((d) => d.extracted_data)
    .map((d) => {
      const data = d.extracted_data as { summary?: string; full_analysis?: string } | null;
      return data?.summary || data?.full_analysis?.slice(0, 300) || "";
    })
    .filter(Boolean);

  const documentInfo = {
    count: extractedDocs.length,
    types: extractedDocs.map((d) => d.document_type),
    analysisSummaries: fileAnalysisSummaries,
  };

  // 답변 저장
  if (answer && questionOrder >= 0) {
    await supabase
      .from("company_interviews")
      .update({ answer })
      .eq("company_id", companyId)
      .eq("question_order", questionOrder);
  }

  // 파일 업로드 여부에 따라 라운드당 질문 수 동적 조절
  // previousQA는 답변 저장 전에 가져온 데이터이므로, 방금 저장한 답변을 수동으로 반영
  const answeredQA = (previousQA ?? []).filter((qa) => qa.answer !== null);
  const hasUploadedFiles = extractedDocs.length > 0;
  const questionsPerRound = hasUploadedFiles ? 2 : 3; // 파일 있으면 2개, 없으면 3개
  // 현재 답변이 있으면 +1 (stale data 보정)
  const totalAnswered = answeredQA.length + (answer ? 1 : 0);
  const roundComplete = totalAnswered > 0 && totalAnswered % questionsPerRound === 0;

  // ========================================
  // 5라운드 완료 시 → 최초 완료인 경우만 인사이트 추출
  // 이미 business_content가 있으면 추가 인터뷰 모드 → 최대 10라운드까지
  // ========================================
  const isFirstCompletion = !company?.business_content;
  const MAX_ROUNDS = 10; // 추가 인터뷰 포함 최대 라운드
  if (currentRound >= 5 && roundComplete && isFirstCompletion) {
    return Response.json({
      type: "interview_complete",
      companyId,
      totalAnswered,
    });
  }

  // 추가 인터뷰 모드에서도 최대 라운드 제한
  if (currentRound >= MAX_ROUNDS && roundComplete) {
    return Response.json({
      type: "interview_complete",
      companyId,
      totalAnswered,
      message: "추가 인터뷰가 최대 라운드에 도달했습니다.",
    });
  }

  // ========================================
  // 라운드 전환 시 → 중간 요약 + 점수 업데이트
  // ========================================
  let roundSummary: { interim_score?: number; [key: string]: unknown } | null = null;

  if (roundComplete && currentRound < 5) {
    try {
      const qaForSummary = answeredQA.map((qa) => ({
        question: qa.question,
        answer: qa.answer ?? "",
      }));

      // 20초 타임아웃으로 라운드 요약 (hang 방지)
      const summaryJson = await Promise.race([
        callClaude({
          model: "claude-haiku-4-5-20251001",
          system: "주어진 인터뷰 대화를 분석하여 JSON을 출력합니다.",
          messages: [{
            role: "user",
            content: buildRoundSummaryPrompt(currentRound, qaForSummary),
          }],
          temperature: 0.2,
          maxTokens: 1000,
        }),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error("Round summary timeout (20s)")), 20_000)
        ),
      ]);

      try {
        const jsonMatch = summaryJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { interim_score?: number; [key: string]: unknown };
          roundSummary = parsed;

          // 중간 점수 업데이트 (유틸 함수 기반 계산)
          const answeredCount = totalAnswered; // 이미 현재 답변 포함됨
          const newScore = calculateProfileScore(company || {}, answeredCount);
          // AI interim_score와 유틸 계산 중 큰 값 사용
          const finalScore = Math.max(newScore, parsed.interim_score || 0);
          await supabase
            .from("companies")
            .update({
              profile_score: finalScore,
              updated_at: new Date().toISOString(),
            })
            .eq("id", companyId);
          // SSE로 보낼 점수도 갱신
          parsed.interim_score = finalScore;
        }
      } catch (parseErr) {
        console.warn("[Interview] JSON 파싱 실패 (라운드 요약):", parseErr);
      }
    } catch (e) {
      console.error("[Interview] Round summary error:", e);
    }
  }

  // ========================================
  // 다음 질문 생성 (SSE 스트리밍)
  // ========================================
  const nextRound = roundComplete ? Math.min(currentRound + 1, MAX_ROUNDS) : currentRound;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let streamClosed = false;
      try {
        // 라운드 전환 이벤트
        if (roundComplete && roundSummary) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              type: "round_complete",
              round: currentRound,
              summary: roundSummary,
              nextRound,
              interimScore: roundSummary.interim_score || 0,
            })}\n\n`)
          );
        }

        const qaHistory = answeredQA.map((qa) => ({
          question: qa.question,
          answer: qa.answer ?? "",
        }));

        const prompt = buildNextQuestionPrompt(
          nextRound,
          qaHistory,
          company ? {
            name: company.name,
            industry: company.industry,
            region: company.region,
          } : undefined,
          documentInfo
        );

        let fullQuestion = "";

        // 스트리밍 전체 45초 타임아웃
        const streamTimeout = setTimeout(() => {
          if (!fullQuestion && !streamClosed) {
            console.error("[Interview] Stream timeout - no response in 45s");
            streamClosed = true;
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "error", message: "AI 응답 시간이 초과되었습니다. 다시 시도해주세요." })}\n\n`)
              );
              controller.close();
            } catch { /* already closed */ }
          }
        }, 45_000);

        for await (const chunk of streamClaude({
          model: "claude-haiku-4-5-20251001",
          system: INTERVIEW_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxTokens: 400,
        })) {
          if (streamClosed) break;
          fullQuestion += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
          );
        }
        clearTimeout(streamTimeout);
        if (streamClosed) return;

        // 질문을 DB에 저장
        const newOrder = (questionOrder || 0) + 1;
        const categoryMap: Record<number, string> = {
          1: "basic",
          2: "business",
          3: "team_evidence",
          4: "strategy",
          5: "optimization",
        };

        await supabase.from("company_interviews").insert({
          company_id: companyId,
          question: fullQuestion,
          category: categoryMap[nextRound] || "basic",
          question_order: newOrder,
          round: nextRound,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              question: fullQuestion,
              questionOrder: newOrder,
              round: nextRound,
            })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        console.error("[Interview] Stream error:", error);
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "error", message: safeErrorMessage(error, "AI 인터뷰 처리 중 오류가 발생했습니다") })}\n\n`)
            );
            controller.close();
          } catch { /* already closed */ }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
