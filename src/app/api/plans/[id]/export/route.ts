import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildDocx } from "@/lib/utils/docx-builder";
import { buildPdf } from "@/lib/utils/pdf-builder";

/**
 * POST /api/plans/[id]/export
 * 사업계획서 내보내기 (마크다운 / DOCX)
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
  const format = body.format || "md";

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
    return Response.json(
      { error: "섹션이 없습니다" },
      { status: 400 }
    );
  }

  const companyName = (plan as any).companies?.name || "회사명";
  const dateStr = new Date().toISOString().slice(0, 10);

  // evaluation_criteria에서 chart_data, kpi_data 추출
  const evalCriteria = (plan as any).evaluation_criteria || {};
  const chartData = evalCriteria.chart_data || {};
  const kpiData = evalCriteria.kpi_data || {};
  const templateType = evalCriteria.template_type || "custom";

  // ===== DOCX 내보내기 =====
  if (format === "docx") {
    try {
      const buffer = await buildDocx({
        title: plan.title,
        companyName,
        sections: sections.map((s: any) => ({
          section_name: s.section_name,
          content: s.content,
          section_order: s.section_order,
        })),
        chartData,
        kpiData,
        templateType,
      });

      const filename = `${companyName}_사업계획서_${dateStr}.docx`;
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } catch (error) {
      console.error("[Export] DOCX 생성 실패:", error);
      return Response.json(
        { error: "DOCX 생성 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }
  }

  // ===== 마크다운 내보내기 =====
  let markdown = `# ${plan.title}\n\n`;
  markdown += `**${companyName}**\n\n`;
  markdown += `작성일: ${new Date().toLocaleDateString("ko-KR")}\n\n---\n\n`;

  for (const section of sections) {
    markdown += `## ${section.section_name}\n\n`;
    markdown += `${section.content || "(미작성)"}\n\n`;
  }

  if (format === "md") {
    const filename = `${companyName}_사업계획서_${dateStr}.md`;
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  }

  // ===== PDF 내보내기 =====
  if (format === "pdf") {
    try {
      const pdfBuffer = await buildPdf({
        title: plan.title,
        companyName,
        sections: sections.map((s: any) => ({
          section_name: s.section_name,
          content: s.content,
          section_order: s.section_order,
        })),
      });

      const filename = `${companyName}_사업계획서_${dateStr}.pdf`;
      return new Response(pdfBuffer, {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        },
      });
    } catch (error) {
      console.error("[Export] PDF 생성 실패:", error);
      return Response.json(
        { error: "PDF 생성 중 오류가 발생했습니다" },
        { status: 500 }
      );
    }
  }

  return Response.json({
    message: "지원하는 형식: md, docx, pdf",
  });
}
