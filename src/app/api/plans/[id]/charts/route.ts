import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { renderChartToSvg, getChartSize } from "@/lib/charts/svg-renderer";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, extractChartsSchema } from "@/lib/api/validation";

/**
 * GET /api/plans/[id]/charts
 * 사업계획서의 차트 데이터 + SVG 렌더링 결과 반환
 * Query params:
 *   - sectionOrder: 특정 섹션만 (선택)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: plan } = await supabase
    .from("business_plans")
    .select("evaluation_criteria, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { companies?: { user_id?: string } }).companies?.user_id !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalCriteria: Record<string, any> = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawChartData: Array<Record<string, any>> = evalCriteria.chart_data || [];
  const templateType = evalCriteria.template_type || "custom";

  if (rawChartData.length === 0) {
    return NextResponse.json({ charts: [], total: 0 });
  }

  // 섹션 필터
  const sectionOrder = request.nextUrl.searchParams.get("sectionOrder");

  // 각 차트를 SVG로 렌더링
  const renderedCharts = rawChartData
    .filter((chart) => {
      if (sectionOrder) {
        return String(chart.section_order) === sectionOrder;
      }
      return true;
    })
    .map((chart) => {
      const chartType = chart.chart_type || chart.type;
      const size = getChartSize(chartType);

      let svg = "";
      try {
        svg = renderChartToSvg(
          { type: chartType, title: chart.title, data: chart.data },
          templateType
        );
      } catch (e) {
        console.warn(`[Charts] SVG 렌더링 실패 (${chartType}):`, e);
        svg = "";
      }

      return {
        chart_type: chartType,
        title: chart.title,
        section_order: chart.section_order || 1,
        position: chart.position || "",
        priority: chart.priority || "medium",
        width: size.width,
        height: size.height,
        svg,
        data: chart.data,
      };
    })
    .filter((c) => c.svg); // SVG 렌더 성공한 것만

  return NextResponse.json({
    charts: renderedCharts,
    total: renderedCharts.length,
    templateType,
  });
}

/**
 * POST /api/plans/[id]/charts
 * 특정 섹션의 차트 데이터를 재추출 (AI)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limiting (AI 차트 추출 엔드포인트)
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`charts:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const { id: planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [chartsBody, chartsErr] = await validateBody(request, extractChartsSchema);
  if (chartsErr) return chartsErr;
  const { sectionName, sectionContent, sectionOrder } = chartsBody;

  // 소유권 확인
  const { data: plan } = await supabase
    .from("business_plans")
    .select("evaluation_criteria, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { companies?: { user_id?: string } }).companies?.user_id !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { callClaudeAPI: callClaude } = await import("@/lib/ai/claude");
  const {
    CHART_DATA_EXTRACTOR_SYSTEM,
    buildChartDataExtractorPrompt,
  } = await import("@/lib/ai/prompts/writing");

  try {
    // AI로 차트 데이터 추출
    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: CHART_DATA_EXTRACTOR_SYSTEM,
      messages: [{
        role: "user",
        content: buildChartDataExtractorPrompt(sectionName, sectionContent),
      }],
      temperature: 0,
      maxTokens: 4000,
    });

    // JSON 파싱
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let newCharts: Array<Record<string, any>> = [];
    try {
      const jsonMatch = result.match(/\{[\s\S]*"charts"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        newCharts = (parsed.charts || []).map((c: Record<string, unknown>) => ({
          ...c,
          section_order: sectionOrder || 1,
        }));
      }
    } catch {}

    // 기존 차트 데이터에서 해당 섹션 제외하고 새 차트로 교체
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalCriteria: Record<string, any> = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingCharts: Array<Record<string, any>> = evalCriteria.chart_data || [];
    const otherCharts = existingCharts.filter(
      (c) => String(c.section_order) !== String(sectionOrder)
    );
    const updatedCharts = [...otherCharts, ...newCharts];

    // DB 업데이트
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminClient = createAdminClient();
    await adminClient
      .from("business_plans")
      .update({
        evaluation_criteria: {
          ...evalCriteria,
          chart_data: updatedCharts,
        },
      })
      .eq("id", planId);

    // 새 차트들의 SVG도 렌더
    const templateType = evalCriteria.template_type || "custom";
    const renderedNewCharts = newCharts.map((chart) => {
      const chartType = chart.chart_type || chart.type;
      const size = getChartSize(chartType);
      let svg = "";
      try {
        svg = renderChartToSvg(
          { type: chartType, title: chart.title, data: chart.data },
          templateType
        );
      } catch {}

      return {
        chart_type: chartType,
        title: chart.title,
        section_order: chart.section_order,
        priority: chart.priority || "medium",
        width: size.width,
        height: size.height,
        svg,
      };
    }).filter((c) => c.svg);

    return NextResponse.json({
      success: true,
      charts: renderedNewCharts,
      total: renderedNewCharts.length,
    });
  } catch (error) {
    console.error("[Charts] 차트 재추출 실패:", error);
    return NextResponse.json(
      { error: "차트 데이터 추출 실패" },
      { status: 500 }
    );
  }
}
