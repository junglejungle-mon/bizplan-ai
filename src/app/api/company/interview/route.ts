import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamClaude } from "@/lib/ai/claude";
import {
  INTERVIEW_SYSTEM_PROMPT,
  buildNextQuestionPrompt,
  INSIGHT_EXTRACTION_PROMPT,
} from "@/lib/ai/prompts/interview";
import { callClaude } from "@/lib/ai/claude";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId, answer, currentRound, questionOrder } = await request.json();

  // 이전 Q&A 가져오기
  const { data: previousQA } = await supabase
    .from("company_interviews")
    .select("question, answer")
    .eq("company_id", companyId)
    .order("question_order", { ascending: true });

  // 답변 저장
  if (answer && questionOrder > 0) {
    await supabase
      .from("company_interviews")
      .update({ answer })
      .eq("company_id", companyId)
      .eq("question_order", questionOrder);
  }

  // 라운드 완료 체크 (라운드당 3~4개 질문)
  const currentRoundQA = (previousQA ?? []).filter(
    (qa) => qa.answer !== null
  );

  const questionsPerRound = 4;
  const totalAnswered = currentRoundQA.length;
  const roundComplete = totalAnswered > 0 && totalAnswered % questionsPerRound === 0;

  // 3라운드 완료 시 인사이트 추출
  if (currentRound >= 3 && roundComplete) {
    const allQA = (previousQA ?? []).filter((qa) => qa.answer);
    const conversationText = allQA
      .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
      .join("\n\n");

    // 인사이트 추출
    const insightsJson = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: INSIGHT_EXTRACTION_PROMPT,
      messages: [{ role: "user", content: conversationText }],
      temperature: 0.3,
    });

    try {
      const insights = JSON.parse(insightsJson);

      // 회사 프로필 업데이트
      const businessContent = allQA
        .map((qa) => `[${qa.question}] ${qa.answer}`)
        .join("\n");

      await supabase
        .from("companies")
        .update({
          business_content: businessContent,
          profile_score: insights.profile_score || 70,
          updated_at: new Date().toISOString(),
        })
        .eq("id", companyId);

      return Response.json({
        type: "complete",
        insights,
        profileScore: insights.profile_score || 70,
      });
    } catch {
      return Response.json({
        type: "complete",
        insights: null,
        profileScore: 50,
      });
    }
  }

  // 다음 질문 생성 (SSE 스트리밍)
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const qaHistory = (previousQA ?? [])
          .filter((qa) => qa.answer)
          .map((qa) => ({
            question: qa.question,
            answer: qa.answer ?? "",
          }));

        const prompt = buildNextQuestionPrompt(currentRound, qaHistory);
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
        await supabase.from("company_interviews").insert({
          company_id: companyId,
          question: fullQuestion,
          category:
            currentRound === 1 ? "basic" : currentRound === 2 ? "business" : "optimization",
          question_order: newOrder,
          round: currentRound,
        });

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              question: fullQuestion,
              questionOrder: newOrder,
              round: currentRound,
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
