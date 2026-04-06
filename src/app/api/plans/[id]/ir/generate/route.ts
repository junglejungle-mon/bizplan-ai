import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateIRWithHarness } from "@/lib/pipeline/ir-generator-with-harness";
import { incrementUsage } from "@/lib/payment/usage";
import { safeErrorMessage } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

// Vercel serverless function 타임아웃 확장 (SSE 스트리밍 — 최대 300초)
export const maxDuration = 300;

/**
 * POST /api/plans/[id]/ir/generate
 * IR PPT 자동 생성 (SSE 스트리밍)
 *
 * 흐름:
 * 1. ir-generator로 1차 슬라이드 생성
 * 2. 인터뷰 답변(있으면) 자동 로드해서 컨텍스트에 주입
 * 3. PPT 하네스 v2로 80점+ 자동 개선 (최대 3라운드)
 * 4. 개선된 슬라이드만 DB UPDATE
 *
 * 변경 (Week 4): generateIRPresentation → generateIRWithHarness
 *   - 11개 패턴 라이브러리 자동 적용
 *   - 인터뷰 답변 자동 통합
 *   - 품질 80점+ 보장
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting (AI IR 생성 엔드포인트)
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`ir-generate:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const { id: planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 사용량 체크
  const usageResult = await incrementUsage(user.id, "ir_generations");
  if (!usageResult.allowed) {
    return Response.json(
      {
        error: "IR 프레젠테이션 생성 한도를 초과했습니다. 유료 플랜으로 업그레이드해주세요.",
        code: "USAGE_LIMIT_EXCEEDED",
        current: usageResult.current,
        limit: usageResult.limit,
        upgradeUrl: "/pricing",
      },
      { status: 429 }
    );
  }

  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { companies?: { user_id?: string } }).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  let selectedTemplate = body.template || "minimal";

  // 브랜드 색상이 있으면 자동으로 custom_ci 적용
  if (!body.template || body.template === "minimal") {
    try {
      const { data: companies } = await supabase
        .from("companies")
        .select("business_content")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(1);

      if (companies && companies.length > 0) {
        const content = (companies[0] as { business_content?: string })?.business_content || "";
        const hasBrandColors = content.includes("[BRAND_COLORS]");
        if (hasBrandColors) {
          selectedTemplate = "custom_ci";
          console.log("[IRGenerate] 브랜드 색상 감지 → custom_ci 템플릿 자동 적용");
        }
      }
    } catch {
      // 실패해도 무시
    }
  }

  // 옵션: 클라이언트가 명시적으로 하네스 비활성화 가능
  const applyHarness = body.applyHarness !== false;
  const passThreshold = typeof body.passThreshold === "number" ? body.passThreshold : 80;
  const maxIterations = typeof body.maxIterations === "number" ? body.maxIterations : 3;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of generateIRWithHarness({
          planId,
          companyId: plan.company_id,
          template: selectedTemplate as "minimal" | "tech" | "classic" | "professional" | "vibrant" | "custom_ci",
          applyHarness,
          passThreshold,
          maxIterations,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } catch (error) {
        console.error("[IRGenerate] Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", data: { message: safeErrorMessage(error, "IR 발표자료 생성 중 오류가 발생했습니다") } })}\n\n`
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
