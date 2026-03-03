import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeAPI as callClaude } from "@/lib/ai/claude";
import {
  CHART_CUSTOMIZER_SYSTEM,
  buildChartCustomizerPrompt,
} from "@/lib/ai/prompts/writing";
import { renderChartToSvg, getChartSize } from "@/lib/charts/svg-renderer";
import { incrementUsage } from "@/lib/payment/usage";

/**
 * POST /api/plans/[id]/charts/customize
 * 사용자 프롬프트 기반 차트 커스터마이징
 *
 * Body:
 * - userPrompt: string (사용자 요청)
 * - sectionOrder: number (대상 섹션 순서)
 * - sectionName: string (섹션명)
 * - targetChartIndex?: number (수정할 특정 차트 인덱스)
 * - presetId?: string (프리셋 ID — UI에서 선택한 프리셋)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 사용량 체크 (섹션 재생성과 동일 한도 공유)
  const usageResult = await incrementUsage(user.id, "section_regenerations");
  if (!usageResult.allowed) {
    return NextResponse.json(
      {
        error: "이번 달 차트 커스터마이징 한도를 초과했습니다.",
        code: "USAGE_LIMIT_EXCEEDED",
        current: usageResult.current,
        limit: usageResult.limit,
        upgradeUrl: "/pricing",
      },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const {
    userPrompt,
    sectionOrder,
    sectionName,
    targetChartIndex,
    presetId,
  } = body as {
    userPrompt?: string;
    sectionOrder?: number;
    sectionName?: string;
    targetChartIndex?: number;
    presetId?: string;
  };

  if (!sectionName) {
    return NextResponse.json({ error: "섹션명이 필요합니다" }, { status: 400 });
  }

  // 프리셋 ID로 프롬프트 자동 생성
  let finalPrompt = userPrompt || "";
  if (presetId && !userPrompt) {
    const { CHART_PRESETS } = await import("@/lib/ai/prompts/writing");
    const preset = CHART_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      finalPrompt = preset.promptTemplate;
    }
  }

  if (!finalPrompt) {
    return NextResponse.json({ error: "요청 내용이 필요합니다 (userPrompt 또는 presetId)" }, { status: 400 });
  }

  // 소유권 확인 + 계획서 로드
  const { data: plan } = await supabase
    .from("business_plans")
    .select("evaluation_criteria, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as { companies?: { user_id?: string } }).companies?.user_id !== user.id) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // 해당 섹션 내용 로드
  const { data: section } = await supabase
    .from("plan_sections")
    .select("section_name, content, section_order")
    .eq("plan_id", planId)
    .eq("section_name", sectionName)
    .single();

  if (!section || !section.content) {
    return NextResponse.json({ error: "섹션을 찾을 수 없습니다" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalCriteria: Record<string, any> = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria || {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const existingCharts: Array<Record<string, any>> = evalCriteria.chart_data || [];
  const templateType = evalCriteria.template_type || "custom";
  const effectiveOrder = sectionOrder ?? section.section_order;

  // 해당 섹션의 기존 차트만 필터
  const sectionCharts = existingCharts.filter(
    (c) => String(c.section_order) === String(effectiveOrder)
  );

  try {
    // AI로 차트 커스터마이징
    const prompt = buildChartCustomizerPrompt({
      userPrompt: finalPrompt,
      sectionName: section.section_name,
      sectionContent: section.content.slice(0, 4000),
      existingCharts: sectionCharts,
      targetChartIndex,
    });

    const result = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: CHART_CUSTOMIZER_SYSTEM,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
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
          section_order: effectiveOrder,
          section_name: section.section_name,
          customized: true,
          customized_at: new Date().toISOString(),
        }));
      }
    } catch {
      return NextResponse.json({ error: "차트 데이터 파싱 실패" }, { status: 500 });
    }

    if (newCharts.length === 0) {
      return NextResponse.json({ error: "AI가 차트 데이터를 생성하지 못했습니다" }, { status: 500 });
    }

    // 기존 차트 데이터에서 해당 섹션 제외하고 새 차트로 교체
    const otherCharts = existingCharts.filter(
      (c) => String(c.section_order) !== String(effectiveOrder)
    );
    const updatedCharts = [...otherCharts, ...newCharts];

    // DB 업데이트
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

    // 새 차트들의 SVG 렌더링
    const renderedCharts = newCharts.map((chart) => {
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
        priority: chart.priority || "high",
        width: size.width,
        height: size.height,
        svg,
        data: chart.data,
        customized: true,
      };
    }).filter((c) => c.svg);

    return NextResponse.json({
      success: true,
      charts: renderedCharts,
      total: renderedCharts.length,
      prompt: finalPrompt,
    });
  } catch (error) {
    console.error("[Charts] 차트 커스터마이징 실패:", error);
    return NextResponse.json(
      { error: "차트 커스터마이징 실패" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plans/[id]/charts/customize
 * 차트 프리셋 목록 반환 (UI에서 프리셋 선택용)
 */
export async function GET() {
  const { CHART_PRESETS } = await import("@/lib/ai/prompts/writing");
  return NextResponse.json({ presets: CHART_PRESETS });
}
