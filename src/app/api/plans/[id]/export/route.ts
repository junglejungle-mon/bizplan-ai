import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/plans/[id]/export
 * 사업계획서 내보내기 (마크다운 → 텍스트)
 * Phase 2에서 DOCX 변환 추가 예정
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

  // 마크다운 문서 조합
  let markdown = `# ${plan.title}\n\n`;
  markdown += `**${companyName}**\n\n`;
  markdown += `작성일: ${new Date().toLocaleDateString("ko-KR")}\n\n---\n\n`;

  for (const section of sections) {
    markdown += `## ${section.section_name}\n\n`;
    markdown += `${section.content || "(미작성)"}\n\n`;
  }

  if (format === "md") {
    const filename = `${companyName}_사업계획서_${new Date().toISOString().slice(0, 10)}.md`;
    return new Response(markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    });
  }

  // TODO: DOCX/PDF 변환 (CloudConvert 연동)
  return Response.json({
    content: markdown,
    format: "md",
    message: "현재 마크다운 형식만 지원됩니다. DOCX/PDF는 곧 지원됩니다.",
  });
}
