import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDocx } from "@/lib/utils/docx-builder";
import { buildPdf } from "@/lib/utils/pdf-builder";
import { exportLogger as log } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin/auth";

export const maxDuration = 60;

/** RFC 5987 호환 Content-Disposition 헤더 생성 */
function makeContentDisposition(filename: string): string {
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`;
}

/**
 * GET /api/admin/plans/[id]/export?format=docx|pdf|md
 * 관리자 사업계획서 다운로드 (인증: admin 미들웨어)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id: planId } = await params;
  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "md";

  const supabase = createAdminClient();

  // 사업계획서 + 섹션 로드
  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies(name)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return Response.json({ error: "계획서를 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: sections } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", planId)
    .order("section_order");

  if (!sections || sections.length === 0) {
    return Response.json({ error: "섹션이 없습니다." }, { status: 400 });
  }

  const companyName = (plan as any).companies?.name || "회사명";
  const dateStr = new Date().toISOString().slice(0, 10);

  // evaluation_criteria에서 chart_data, kpi_data 추출
  const evalCriteria = (plan as any).evaluation_criteria || {};
  const rawChartData = evalCriteria.chart_data || [];
  const rawKpiData = evalCriteria.kpi_data || {};
  const templateType = evalCriteria.template_type || "custom";

  // kpi_data 정규화
  const kpis = rawKpiData.kpis || rawKpiData;
  const kpiData: Record<string, any> = {};
  if (kpis.revenue) {
    kpiData.revenue = Array.isArray(kpis.revenue)
      ? `${kpis.revenue[kpis.revenue.length - 1]?.value || ""}${kpis.revenue[kpis.revenue.length - 1]?.unit || "원"}`
      : String(kpis.revenue);
  }
  if (kpis.growth_rate) kpiData.revenue_growth = String(kpis.growth_rate);
  if (kpis.employees) kpiData.employees = String(kpis.employees);
  if (kpis.tam) {
    kpiData.tam = typeof kpis.tam === "object"
      ? `${kpis.tam.value || ""}${kpis.tam.unit || ""}`
      : String(kpis.tam);
  }
  if (kpis.patents) kpiData.patents = String(kpis.patents);
  if (kpis.milestones) kpiData.milestones = kpis.milestones;
  if (rawKpiData.company_name) kpiData.company_name = rawKpiData.company_name;

  // chart_data 변환
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
  } else if (typeof rawChartData === "object") {
    Object.assign(chartData, rawChartData);
  }

  const sectionsMapped = sections.map((s: any) => ({
    section_name: s.section_name,
    content: s.content,
    section_order: s.section_order,
  }));

  // ===== DOCX =====
  if (format === "docx") {
    try {
      const buffer = await buildDocx({
        title: plan.title,
        companyName,
        sections: sectionsMapped,
        chartData,
        kpiData,
        templateType,
      });
      const filename = `${companyName}_사업계획서_${dateStr}.docx`;
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": makeContentDisposition(filename),
        },
      });
    } catch (error) {
      log.error({ err: error, planId, format: "docx" }, "Admin DOCX 생성 실패");
      return Response.json({ error: "DOCX 생성 실패" }, { status: 500 });
    }
  }

  // ===== PDF =====
  if (format === "pdf") {
    try {
      const pdfBuffer = await buildPdf({
        title: plan.title,
        companyName,
        sections: sectionsMapped,
        chartData,
        kpiData,
        templateType,
      });
      const filename = `${companyName}_사업계획서_${dateStr}.pdf`;
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": makeContentDisposition(filename),
        },
      });
    } catch (error) {
      log.error({ err: error, planId, format: "pdf" }, "Admin PDF 생성 실패");
      return Response.json({ error: "PDF 생성 실패" }, { status: 500 });
    }
  }

  // ===== Markdown (기본) =====
  let markdown = `# ${plan.title}\n\n`;
  markdown += `**${companyName}**\n\n`;
  markdown += `작성일: ${new Date().toLocaleDateString("ko-KR")}\n\n---\n\n`;

  for (const section of sections) {
    markdown += `## ${section.section_name}\n\n`;
    markdown += `${section.content || "(미작성)"}\n\n`;
  }

  const filename = `${companyName}_사업계획서_${dateStr}.md`;
  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": makeContentDisposition(filename),
    },
  });
}
