import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildPptx } from "@/lib/pptx/pptx-builder";
import { hasTemplate, buildFromTemplate } from "@/lib/pptx/template-builder";

export const maxDuration = 60; // PPTX 생성에 시간 필요

/** RFC 5987 호환 Content-Disposition 헤더 생성 */
function makeContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

/**
 * POST /api/plans/[id]/ir/export
 * PPTX 내보내기 (pptxgenjs 기반)
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
  const format = (body as { format?: string })?.format || "pptx";

  // IR 프레젠테이션 로드 (완료된 것만)
  const { data: presentation } = await supabase
    .from("ir_presentations")
    .select("*, companies!inner(name, user_id)")
    .eq("plan_id", planId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!presentation || (presentation as { companies?: { user_id?: string; name?: string } }).companies?.user_id !== user.id) {
    // status=completed 가 없으면 generating 중인지 확인
    const { data: pendingPres } = await supabase
      .from("ir_presentations")
      .select("status")
      .eq("plan_id", planId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (pendingPres?.status === "generating") {
      return Response.json(
        { error: "IR 자료가 아직 생성 중입니다. 잠시 후 다시 시도해주세요." },
        { status: 202 }
      );
    }
    return Response.json(
      { error: "완료된 IR 자료가 없습니다. IR 자료를 먼저 생성해주세요." },
      { status: 404 }
    );
  }

  // 슬라이드 로드
  const { data: slides, error: slidesError } = await supabase
    .from("ir_slides")
    .select("*")
    .eq("presentation_id", presentation.id)
    .order("slide_order");

  if (slidesError) {
    console.error("[IR Export] 슬라이드 로드 실패:", slidesError.message);
    return Response.json(
      { error: "슬라이드 로드에 실패했습니다." },
      { status: 500 }
    );
  }

  if (!slides || slides.length === 0) {
    return Response.json(
      { error: "슬라이드가 없습니다. IR 자료를 다시 생성해주세요." },
      { status: 400 }
    );
  }

  const companyName = (presentation as { companies?: { user_id?: string; name?: string } }).companies?.name || "회사명";

  // custom_ci 템플릿인 경우 브랜드 색상 로드
  let customColors: {
    primary: string;
    secondary: string;
    accent: string;
    bg?: string;
    textDark?: string;
    textLight?: string;
    chartColors?: string[];
  } | undefined;
  const templateName = (presentation.template as string) || "minimal";

  if (templateName === "custom_ci") {
    try {
      const { data: companies } = await supabase
        .from("companies")
        .select("business_content")
        .eq("user_id", user.id)
        .limit(1);

      if (companies && companies.length > 0) {
        const content = (companies[0] as { business_content?: string })?.business_content || "";
        const match = content.match(/\[BRAND_COLORS\]\n([\s\S]*?)\n\[\/BRAND_COLORS\]/);
        if (match) {
          const parsed = JSON.parse(match[1]);
          customColors = {
            primary: parsed.primary || "1A1A2E",
            secondary: parsed.secondary || "023793",
            accent: parsed.accent || "4361EE",
            bg: parsed.bg,
            textDark: parsed.textDark,
            textLight: parsed.textLight,
            chartColors: parsed.chartColors,
          };
        }
      }
    } catch (e) {
      console.warn("[IR Export] 브랜드 색상 로드 실패:", e);
    }
  }

  // PDF 내보내기 — pptxgenjs PPTX를 그대로 전달 (PDF 변환은 클라이언트에서)
  if (format === "pdf") {
    return Response.json(
      { error: "PDF는 PPTX 다운로드 후 PowerPoint에서 PDF로 저장해주세요." },
      { status: 400 }
    );
  }

  // PPTX 생성 — 템플릿 파일이 있으면 pptx-automizer, 없으면 pptxgenjs
  try {
    let pptxBuffer: Buffer;

    if (hasTemplate(templateName)) {
      // pptx-automizer: 디자이너 제작 템플릿 기반 고품질 PPT
      pptxBuffer = await buildFromTemplate({
        templateFile: `${templateName}.pptx`,
        companyName,
        slides: slides.map((s) => ({
          slide_type: s.slide_type,
          title: s.title,
          content: (s.content || {}) as { headline?: string; subtext?: string; bullets?: string[]; stats?: Array<{ value: string; label: string }> },
          notes: s.notes || undefined,
        })),
      });
    } else {
      // pptxgenjs: 코드 기반 동적 생성 (기본)
      pptxBuffer = await buildPptx({
        companyName,
        template: templateName as "minimal" | "tech" | "classic" | "professional" | "vibrant" | "custom_ci",
        slides: slides.map((s) => ({
          slide_type: s.slide_type as "cover" | "problem" | "solution" | "market" | "business_model" | "traction" | "competition" | "team" | "financials" | "ask" | "roadmap" | "tech",
          title: s.title,
          content: (s.content || {}) as Record<string, unknown>,
          notes: s.notes,
        })),
        customColors,
      });
    }

    const filename = `${companyName}_IR_${new Date().toISOString().slice(0, 10)}.pptx`;

    const uint8Array = new Uint8Array(pptxBuffer);
    return new Response(uint8Array, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": makeContentDisposition(filename),
      },
    });
  } catch (buildError) {
    console.error("[IR Export] PPTX 빌드 실패:", buildError);
    return Response.json(
      { error: "PPTX 생성에 실패했습니다." },
      { status: 500 }
    );
  }
}
