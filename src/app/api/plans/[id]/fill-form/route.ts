import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exportHwpxWithFormFill } from "@/lib/hwpx";

/**
 * POST /api/plans/[id]/fill-form
 * 양식 채우기 전용 API
 *
 * 응답:
 *   - 성공: HWPX 파일 (binary)
 *   - 실패: JSON { error, details }
 *
 * 헤더:
 *   - X-Fill-Strategy: smart_fill | placeholder_fill | from_scratch
 *   - X-Filled-Fields: 채워진 필드 수
 *   - X-Skipped-Fields: 스킵된 필드 수
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 사업계획서 + 섹션 로드
  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies!inner(name, user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  const { data: sections } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", planId)
    .order("section_order");

  if (!sections || sections.length === 0) {
    return Response.json({ error: "섹션이 없습니다" }, { status: 400 });
  }

  const companyName = (plan as any).companies?.name || "회사명";
  const evalCriteria = (plan as any).evaluation_criteria || {};
  const templateType = evalCriteria.template_type || "custom";

  // chart_data 변환
  const rawChartData = evalCriteria.chart_data || [];
  const chartData: Record<string, any[]> = {};
  if (Array.isArray(rawChartData)) {
    for (const chart of rawChartData) {
      const sectionKey = `section_${chart.section_order || 1}`;
      if (!chartData[sectionKey]) chartData[sectionKey] = [];
      chartData[sectionKey].push({
        type: chart.chart_type || chart.type,
        title: chart.title,
        data: chart.data,
      });
    }
  }

  try {
    const result = await exportHwpxWithFormFill(
      {
        planId,
        title: plan.title,
        companyName,
        programId: plan.program_id || undefined,
        sections: sections.map((s: any) => ({
          section_name: s.section_name,
          content: s.content,
          section_order: s.section_order,
        })),
        chartData,
        kpiData: evalCriteria.kpi_data,
        templateType,
      },
      supabase
    );

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `${companyName}_사업계획서_${dateStr}.hwpx`;

    return new Response(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "application/hwp+zip",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "X-Fill-Strategy": result.strategy,
        "X-Filled-Fields": String(result.filledFields),
        "X-Skipped-Fields": String(result.skippedFields),
      },
    });
  } catch (error) {
    console.error("[fill-form] 양식 채우기 실패:", error);
    return Response.json(
      {
        error: "양식 채우기 중 오류가 발생했습니다",
        details: error instanceof Error ? error.message : "알 수 없는 오류",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/plans/[id]/fill-form
 * 양식 채우기 상태 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: planId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: plan } = await supabase
    .from("business_plans")
    .select("program_id, form_template_id, fill_strategy, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  // 양식 템플릿 정보 조회
  let formTemplate = null;
  if (plan.form_template_id) {
    const { data } = await supabase
      .from("form_templates")
      .select("id, form_title, status, file_type, parsed_structure, error_message")
      .eq("id", plan.form_template_id)
      .single();
    formTemplate = data;
  } else if (plan.program_id) {
    const { data } = await supabase
      .from("form_templates")
      .select("id, form_title, status, file_type, parsed_structure, error_message")
      .eq("program_id", plan.program_id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    formTemplate = data;
  }

  return Response.json({
    planId,
    programId: plan.program_id,
    fillStrategy: plan.fill_strategy,
    formTemplate: formTemplate
      ? {
          id: formTemplate.id,
          title: formTemplate.form_title,
          status: formTemplate.status,
          fileType: formTemplate.file_type,
          fieldCount: (formTemplate.parsed_structure as any)?.metadata?.totalFields ?? null,
          error: formTemplate.error_message,
        }
      : null,
  });
}
