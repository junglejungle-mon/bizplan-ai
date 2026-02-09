import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import {
  INSIGHT_EXTRACTION_PROMPT,
  BUSINESS_CONTENT_BUILDER_PROMPT,
} from "@/lib/ai/prompts/interview";

// Vercel 타임아웃 확장
export const maxDuration = 60;

/**
 * POST /api/company/interview/insights
 * 인터뷰 완료 후 인사이트 추출 + business_content 생성
 * SSE 스트리밍으로 진행 상황 전달 (타임아웃 방지)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId } = await request.json();

  if (!companyId) {
    return Response.json({ error: "companyId is required" }, { status: 400 });
  }

  // 전체 Q&A 로드
  const { data: allQA } = await supabase
    .from("company_interviews")
    .select("question, answer, question_order")
    .eq("company_id", companyId)
    .not("answer", "is", null)
    .order("question_order", { ascending: true });

  if (!allQA || allQA.length === 0) {
    return Response.json({ error: "No interview data found" }, { status: 404 });
  }

  const conversationText = allQA
    .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
    .join("\n\n");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      try {
        // ========================================
        // Step 1: 구조화된 인사이트 추출 (JSON)
        // ========================================
        send({
          type: "progress",
          step: "인터뷰 데이터에서 핵심 인사이트를 추출하고 있습니다...",
          progress: 10,
        });

        const insightsJson = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: INSIGHT_EXTRACTION_PROMPT,
          messages: [{ role: "user", content: conversationText }],
          temperature: 0.2,
          maxTokens: 2000,
        });

        let insights: Record<string, unknown> = {};
        try {
          const jsonMatch = insightsJson.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            insights = JSON.parse(jsonMatch[0]);
          }
        } catch {
          insights = { profile_score: 50 };
        }

        send({
          type: "insights_extracted",
          progress: 50,
          step: "인사이트 추출 완료! 사업 프로필을 구축하고 있습니다...",
        });

        // ========================================
        // Step 2: business_content 구조화 생성
        // ========================================
        const businessContent = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: BUSINESS_CONTENT_BUILDER_PROMPT,
          messages: [{
            role: "user",
            content: `## 인터뷰 대화\n${conversationText}\n\n## 추출된 인사이트\n${JSON.stringify(insights, null, 2)}`,
          }],
          temperature: 0.3,
          maxTokens: 2000,
        });

        send({
          type: "content_generated",
          progress: 80,
          step: "사업 프로필 생성 완료! 데이터를 저장하고 있습니다...",
        });

        // ========================================
        // Step 3: DB 업데이트
        // ========================================
        const profileScore = (insights.profile_score as number) || 70;

        await supabase
          .from("companies")
          .update({
            business_content: businessContent,
            profile_score: profileScore,
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyId);

        // 인사이트를 company_interviews의 마지막 항목에 저장
        const lastOrder = allQA.length > 0
          ? Math.max(...allQA.map((q) => q.question_order || 0))
          : 0;

        if (lastOrder > 0) {
          await supabase
            .from("company_interviews")
            .update({ extracted_insights: insights })
            .eq("company_id", companyId)
            .eq("question_order", lastOrder);
        }

        // ========================================
        // Step 4: 완료 이벤트
        // ========================================
        send({
          type: "complete",
          progress: 100,
          step: "완료!",
          profileScore,
          insights,
          scoreBreakdown: insights.score_breakdown || null,
          missingData: insights.missing_data || [],
          strategicDirection: insights.strategic_direction || null,
        });

        controller.close();
      } catch (error) {
        console.error("[Insights] Extraction error:", error);
        send({
          type: "error",
          message: String(error),
        });
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
