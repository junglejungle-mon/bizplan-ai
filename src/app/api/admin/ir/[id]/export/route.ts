import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPptx } from "@/lib/pptx/pptx-builder";
import { exportLogger as log } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin/auth";

export const maxDuration = 60;

/** RFC 5987 호환 Content-Disposition 헤더 생성 */
function makeContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

/**
 * GET /api/admin/ir/[id]/export
 * 관리자 IR PPTX 다운로드
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id: presentationId } = await params;
  const supabase = createAdminClient();

  // IR 프레젠테이션 로드
  const { data: presentation } = await supabase
    .from("ir_presentations")
    .select("*, companies(name)")
    .eq("id", presentationId)
    .single();

  if (!presentation) {
    return Response.json({ error: "IR 프레젠테이션을 찾을 수 없습니다." }, { status: 404 });
  }

  // 슬라이드 로드
  const { data: slides, error: slidesError } = await supabase
    .from("ir_slides")
    .select("*")
    .eq("presentation_id", presentationId)
    .order("slide_order");

  if (slidesError) {
    log.error({ err: slidesError, presentationId }, "슬라이드 로드 실패");
    return Response.json({ error: "슬라이드 로드 실패" }, { status: 500 });
  }

  if (!slides || slides.length === 0) {
    return Response.json({ error: "슬라이드가 없습니다." }, { status: 400 });
  }

  const companyName = (presentation as { companies?: { name?: string } | null }).companies?.name || "회사명";

  try {
    const pptxBuffer = await buildPptx({
      companyName,
      template: (presentation.template as "minimal" | "tech" | "classic" | "professional" | "vibrant" | "custom_ci") || "minimal",
      slides: slides.map((s) => ({
        slide_type: s.slide_type as "cover" | "problem" | "solution" | "market" | "business_model" | "traction" | "competition" | "team" | "financials" | "ask" | "roadmap" | "tech",
        title: s.title,
        content: (s.content || {}) as Record<string, unknown>,
        notes: s.notes,
      })),
    });

    const filename = `${companyName}_IR_${new Date().toISOString().slice(0, 10)}.pptx`;
    const uint8Array = new Uint8Array(pptxBuffer);

    return new Response(uint8Array, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": makeContentDisposition(filename),
      },
    });
  } catch (error) {
    log.error({ err: error, presentationId }, "PPTX 빌드 실패");
    return Response.json({ error: "PPTX 생성 실패" }, { status: 500 });
  }
}
