import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateBusinessPlan } from "@/lib/pipeline/plan-generator";

/**
 * POST /api/plans/[id]/generate
 * 사업계획서 AI 자동 생성 (SSE 스트리밍)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
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

  if (!plan || (plan as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
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
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", data: { message: String(error) } })}\n\n`
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
