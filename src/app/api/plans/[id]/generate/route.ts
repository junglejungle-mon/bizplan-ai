import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBusinessPlan } from "@/lib/pipeline/plan-generator";
import { rateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { incrementUsage } from "@/lib/payment/usage";
import { safeErrorMessage } from "@/lib/api/error";

// Vercel serverless function 타임아웃 확장 (SSE 스트리밍 — 최대 300초)
export const maxDuration = 300;

/**
 * POST /api/plans/[id]/generate
 * 사업계획서 AI 자동 생성 (SSE 스트리밍)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;

  // Rate limiting
  const ip = getClientIP(request);
  const rl = rateLimit(`generate:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 플랜 확인
  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies!inner(user_id, business_content)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { companies?: { user_id?: string } }).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  // 이어쓰기(resume) 여부 확인 — 이미 생성된 섹션이 있으면 resume
  const { data: existingSections } = await supabase
    .from("plan_sections")
    .select("id, content")
    .eq("plan_id", planId)
    .not("content", "is", null);

  const isResume = existingSections && existingSections.some(
    (s: { id: string; content: string | null }) => s.content && s.content.length > 100
  );

  // 사용량 체크 (무료: 1건/월, 유료: 플랜별 제한)
  // 이어쓰기(resume)인 경우 이미 카운트된 생성이므로 usage 증가 생략
  if (!isResume) {
    const usageResult = await incrementUsage(user.id, "plan_generations");
    if (!usageResult.allowed) {
      return Response.json(
        {
          error: "이번 달 사업계획서 생성 한도를 초과했습니다.",
          code: "USAGE_LIMIT_EXCEEDED",
          current: usageResult.current,
          limit: usageResult.limit,
          upgradeUrl: "/pricing",
        },
        { status: 429 }
      );
    }
  }

  const body = await request.json().catch(() => ({}));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateBusinessPlan({
          planId,
          companyId: plan.company_id,
          programId: plan.program_id || undefined,
          templateOcrText: body.templateOcrText || plan.template_ocr_text || undefined,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } catch (error) {
        console.error("[PlanGenerate] Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", data: { message: safeErrorMessage(error, "사업계획서 생성 중 오류가 발생했습니다") } })}\n\n`
          )
        );
      }
      controller.close();
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
