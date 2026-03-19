import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import { validateBody, interviewInsightsSchema } from "@/lib/api/validation";
import {
  INSIGHT_EXTRACTION_PROMPT,
  BUSINESS_CONTENT_BUILDER_PROMPT,
} from "@/lib/ai/prompts/interview";
import { runMatchingPipeline } from "@/lib/pipeline/matcher";
import { calculateProfileScore } from "@/lib/utils/profile-score";

// Vercel 타임아웃 확장
export const maxDuration = 60;

/**
 * POST /api/company/interview/insights
 * 인터뷰 완료 후 인사이트 추출 + business_content 생성
 * SSE 스트리밍으로 진행 상황 전달 (타임아웃 방지)
 * ★ Admin client 사용: 인터뷰 완료 시점에 세션이 만료되어도 정상 동작
 */
export async function POST(request: NextRequest) {
  // 세션 검증 시도 (실패해도 companyId로 진행)
  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id || null;
  } catch {}

  const [insightsBody, insightsErr] = await validateBody(request, interviewInsightsSchema);
  if (insightsErr) return insightsErr;
  const { companyId } = insightsBody;

  if (!userId && !companyId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Admin client 사용 (세션 만료 문제 방지)
  const supabase = createAdminClient();

  // 전체 Q&A 로드 (최대 50건 — 10라운드 × 3문답 + 여유)
  const { data: allQA } = await supabase
    .from("company_interviews")
    .select("question, answer, question_order")
    .eq("company_id", companyId)
    .not("answer", "is", null)
    .order("question_order", { ascending: true })
    .limit(50);

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
        // Step 3: DB 업데이트 — 점수는 유틸 함수로 정확히 계산
        // ========================================
        // 회사 기본 정보 조회 (점수 계산용)
        const { data: companyData } = await supabase
          .from("companies")
          .select("name, industry, region, employee_count, revenue, established_date")
          .eq("id", companyId)
          .single();

        // business_content가 생성되었으므로 포함하여 점수 계산
        const profileScore = calculateProfileScore(
          { ...companyData, business_content: businessContent },
          allQA.length
        );

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
        // Step 4: 매칭은 비동기로 백그라운드 실행 (사용자 대기 없음)
        // ========================================
        if (profileScore >= 20) {
          send({
            type: "progress",
            progress: 90,
            step: "프로필 저장 완료! 지원사업 매칭을 백그라운드에서 시작합니다...",
          });

          // 매칭을 기다리지 않고 백그라운드에서 실행
          runMatchingPipeline(companyId)
            .then(() => {
            })
            .catch((err) => {
              console.error("[Insights] 백그라운드 매칭 실패:", err);
            });
        }

        // ========================================
        // Step 5: 완료 이벤트 (매칭 완료를 기다리지 않음)
        // ========================================
        send({
          type: "complete",
          progress: 100,
          step: "완료! 지원사업 매칭이 백그라운드에서 진행됩니다.",
          profileScore,
          insights,
          scoreBreakdown: insights.score_breakdown || null,
          missingData: insights.missing_data || [],
          strategicDirection: insights.strategic_direction || null,
          matchedCount: 0, // 매칭은 백그라운드에서 진행 중
          matchingInProgress: true,
        });

        controller.close();
      } catch (error) {
        console.error("[Insights] Extraction error:", error);
        send({
          type: "error",
          message: "인사이트 추출 중 오류가 발생했습니다",
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
