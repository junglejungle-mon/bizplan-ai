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
 * HTML→이미지 차트 렌더링 (Playwright 사용 가능 시)
 * Playwright가 없으면 빈 Map 반환 → pptxgenjs 네이티브 차트로 폴백
 */
async function tryRenderChartImages(
  slides: Array<{ slide_type: string; content: Record<string, unknown> }>,
  templateName: string
): Promise<Map<number, { chart?: Buffer; stats?: Buffer }>> {
  const imageMap = new Map<number, { chart?: Buffer; stats?: Buffer }>();

  try {
    // dynamic import — Playwright가 설치되지 않은 환경(Vercel 등)에서는 실패
    const { renderChartImage, renderStatsImage, closeBrowser } = await import("@/lib/pptx/chart-renderer");

    // 템플릿 색상 매핑
    const TEMPLATE_COLORS: Record<string, {
      primary: string; secondary: string; accent: string; bg: string;
      textDark: string; textLight: string; chartColors: string[]; positive: string;
    }> = {
      minimal: { primary: "1A1A2E", secondary: "023793", accent: "4361EE", bg: "FFFFFF", textDark: "1A1A2E", textLight: "6B7280", chartColors: ["023793", "4361EE", "6C8EF2", "A0B4F5", "D0DBF9"], positive: "22C55E" },
      tech: { primary: "58A6FF", secondary: "388BFD", accent: "7EE787", bg: "0D1117", textDark: "FFFFFF", textLight: "8B949E", chartColors: ["58A6FF", "388BFD", "7EE787", "D2A8FF", "F778BA"], positive: "7EE787" },
      classic: { primary: "2C3E50", secondary: "003366", accent: "E74C3C", bg: "FFFFFF", textDark: "2C3E50", textLight: "7F8C8D", chartColors: ["2C3E50", "E74C3C", "3498DB", "2ECC71", "F39C12"], positive: "2ECC71" },
      professional: { primary: "1E3A5F", secondary: "2E5D8A", accent: "3B82F6", bg: "FFFFFF", textDark: "1E3A5F", textLight: "64748B", chartColors: ["1E3A5F", "3B82F6", "60A5FA", "93C5FD", "BFDBFE"], positive: "22C55E" },
      vibrant: { primary: "4F46E5", secondary: "6366F1", accent: "A855F7", bg: "FFFFFF", textDark: "1E1B4B", textLight: "6B7280", chartColors: ["4F46E5", "A855F7", "EC4899", "F59E0B", "10B981"], positive: "10B981" },
    };
    const colors = TEMPLATE_COLORS[templateName] || TEMPLATE_COLORS.minimal;

    // 각 슬라이드의 차트/stats를 병렬 렌더링
    const renderPromises: Promise<void>[] = [];

    for (let i = 0; i < slides.length; i++) {
      const content = slides[i].content || {};
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const chart = content.chart as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stats = content.stats as any[];

      if (chart || (stats && stats.length > 0)) {
        const idx = i;
        renderPromises.push((async () => {
          const images: { chart?: Buffer; stats?: Buffer } = {};
          try {
            if (chart && chart.type && chart.data) {
              images.chart = await renderChartImage(chart, colors);
            }
            if (stats && stats.length > 0) {
              images.stats = await renderStatsImage(stats, colors);
            }
            if (images.chart || images.stats) {
              imageMap.set(idx, images);
            }
          } catch (renderErr) {
            console.warn(`[IR Export] 슬라이드 ${idx} 차트 렌더링 실패 (폴백):`, renderErr);
          }
        })());
      }
    }

    await Promise.all(renderPromises);
    await closeBrowser(); // 브라우저 정리

    console.log(`[IR Export] HTML 차트 ${imageMap.size}개 슬라이드 렌더링 완료`);
  } catch (importErr) {
    // Playwright 미설치 or import 실패 → 네이티브 차트로 폴백
    console.log("[IR Export] Playwright 미사용 (네이티브 차트 모드):", (importErr as Error).message?.substring(0, 80));
  }

  return imageMap;
}

/**
 * POST /api/plans/[id]/ir/export
 * PPTX 내보내기 (하이브리드: Playwright HTML차트 + pptxgenjs)
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
    return Response.json({ error: "슬라이드 로드에 실패했습니다." }, { status: 500 });
  }

  if (!slides || slides.length === 0) {
    return Response.json({ error: "슬라이드가 없습니다. IR 자료를 다시 생성해주세요." }, { status: 400 });
  }

  const companyName = (presentation as { companies?: { user_id?: string; name?: string } }).companies?.name || "회사명";

  // custom_ci 브랜드 색상 로드
  let customColors: {
    primary: string; secondary: string; accent: string;
    bg?: string; textDark?: string; textLight?: string; chartColors?: string[];
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
            bg: parsed.bg, textDark: parsed.textDark,
            textLight: parsed.textLight, chartColors: parsed.chartColors,
          };
        }
      }
    } catch (e) {
      console.warn("[IR Export] 브랜드 색상 로드 실패:", e);
    }
  }

  if (format === "pdf") {
    return Response.json(
      { error: "PDF는 PPTX 다운로드 후 PowerPoint에서 PDF로 저장해주세요." },
      { status: 400 }
    );
  }

  // PPTX 생성
  try {
    let pptxBuffer: Buffer;
    const isDesignerTemplate = templateName.startsWith("designer_") && hasTemplate(templateName);

    if (isDesignerTemplate) {
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
      // HTML 차트 이미지 미리 렌더링 (Playwright 사용 가능 시)
      const slideDataForRender = slides.map((s) => ({
        slide_type: s.slide_type,
        content: (s.content || {}) as Record<string, unknown>,
      }));
      const preRenderedImages = await tryRenderChartImages(slideDataForRender, templateName);

      // pptxgenjs 빌드 (HTML 차트 이미지 있으면 사용, 없으면 네이티브 차트)
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
        useHtmlCharts: preRenderedImages.size > 0,
        preRenderedImages,
      });
    }

    const filename = `${companyName}_IR_${new Date().toISOString().slice(0, 10)}.pptx`;
    const uint8Array = new Uint8Array(pptxBuffer);
    return new Response(uint8Array, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": makeContentDisposition(filename),
      },
    });
  } catch (buildError) {
    console.error("[IR Export] PPTX 빌드 실패:", buildError);
    return Response.json({ error: "PPTX 생성에 실패했습니다." }, { status: 500 });
  }
}
