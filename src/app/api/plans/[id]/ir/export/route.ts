import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPptx } from "@/lib/pptx/pptx-builder";

/**
 * POST /api/plans/[id]/ir/export
 * PPTX/PDF 내보내기
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

  const body = await request.json().catch(() => ({}));
  // format 지원: pptx (기본), pdf는 Phase 6에서 추가
  const _format = body.format || "pptx";

  // IR 프레젠테이션 로드
  const { data: presentation } = await supabase
    .from("ir_presentations")
    .select("*, companies!inner(name, user_id)")
    .eq("plan_id", planId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!presentation || (presentation as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  // 슬라이드 로드
  const { data: slides } = await supabase
    .from("ir_slides")
    .select("*")
    .eq("presentation_id", presentation.id)
    .order("slide_order");

  if (!slides || slides.length === 0) {
    return Response.json(
      { error: "슬라이드가 없습니다" },
      { status: 400 }
    );
  }

  const companyName = (presentation as any).companies?.name || "회사명";

  // PPTX 생성
  const pptxBuffer = await buildPptx({
    companyName,
    template: (presentation.template as any) || "minimal",
    slides: slides.map((s: any) => ({
      slide_type: s.slide_type,
      title: s.title,
      content: s.content || {},
      notes: s.notes,
    })),
  });

  const filename = `${companyName}_IR_${new Date().toISOString().slice(0, 10)}.pptx`;

  // Convert Buffer to Uint8Array for Response compatibility
  const uint8Array = new Uint8Array(pptxBuffer);
  return new Response(uint8Array, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
    },
  });
}
