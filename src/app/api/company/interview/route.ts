import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamClaude, callClaude } from "@/lib/ai/claude";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildNextQuestionPrompt,
  buildRoundSummaryPrompt,
} from "@/lib/ai/prompts/interview";

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

  // 회사 정보 가져오기 (전략 유도에 활용)
  const { data: company } = await supabase
    .from("companies")
    .select("name, industry, region")
    .eq("id", companyId)
    .single();

  // 이전 Q&A 가져오기
  const { data: previousQA } = await supabase
    .from("company_interviews")
    .select("question, answer, round, question_order")
    .eq("company_id", companyId)
    .order("question_order", { ascending: true });

  // 답변 저장
  if (answer && questionOrder >= 0) {
    await supabase
      .from("company_interviews")
      .update({ answer })
      .eq("company_id", companyId)
      .eq("question_order", questionOrder);
  }

  // 라운드 완료 체크 (라운드당 3~4개 질문)
  const answeredQA = (previousQA ?? []).filter((qa) => qa.answer !== null);
  const questionsPerRound = 4;
  const totalAnswered = answeredQA.length;
  const roundComplete = totalAnswered > 0 && totalAnswered % questionsPerRound === 0;

  // ========================================
  // 5라운드 완료 시 → 즉시 완료 응답 (인사이트는 별도 API에서 추출)
  // ========================================
  if (currentRound >= 5 && roundComplete) {
    return Response.json({
      type: "interview_complete",
      companyId,
      totalAnswered: answeredQA.length,
    });
  }

  // ========================================
  // 라운드 전환 시 → 중간 요약 + 점수 업데이트
  // ========================================
  let roundSummary: any = null;

  if (roundComplete && currentRound < 5) {
    try {
      const qaForSummary = answeredQA.map((qa) => ({
        question: qa.question,
        answer: qa.answer ?? "",
      }));

      const summaryJson = await callClaude({
        model: "claude-haiku-4-5-20251001",
        system: "주어진 인터뷰 대화를 분석하여 JSON을 출력합니다.",
        messages: [{
          role: "user",
          content: buildRoundSummaryPrompt(currentRound, qaForSummary),
        }],
        temperature: 0.2,
        maxTokens: 1000,
      });

      try {
        const jsonMatch = summaryJson.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          roundSummary = JSON.parse(jsonMatch[0]);

          // 중간 점수 업데이트
          if (roundSummary.interim_score) {
            await supabase
              .from("companies")
              .update({
                profile_score: roundSummary.interim_score,
                updated_at: new Date().toISOString(),
              })
              .eq("id", companyId);
          }
        }
      } catch {}
    } catch (e) {
      console.error("[Interview] Round summary error:", e);
    }
  }

  // ========================================
  // 다음 질문 생성 (SSE 스트리밍)
  // ========================================
  const nextRound = roundComplete ? Math.min(currentRound + 1, 5) : currentRound;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
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
          } : undefined
        );

        let fullQuestion = "";

        for await (const chunk of streamClaude({
          model: "claude-sonnet-4-20250514",
          system: INTERVIEW_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          maxTokens: 500,
        })) {
          fullQuestion += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`)
          );
        }

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
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "error", message: String(error) })}\n\n`)
        );
        controller.close();
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
