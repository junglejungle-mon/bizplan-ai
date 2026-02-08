import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamClaude } from "@/lib/ai/claude";
import {
  SECTION_WRITER_SYSTEM,
  buildSectionWriterPrompt,
} from "@/lib/ai/prompts/writing";

/**
 * POST /api/plans/[id]/sections/[sId]/regenerate
 * 개별 섹션 AI 재생성 (SSE 스트리밍)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sId: string }> }
) {
  const { id: planId, sId: sectionId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 사업계획서 + 회사 정보 로드
  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies!inner(*, user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  // 해당 섹션 로드
  const { data: section } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("id", sectionId)
    .eq("plan_id", planId)
    .single();

  if (!section) {
    return new Response("Section Not Found", { status: 404 });
  }

  // 이전 섹션들 로드 (컨텍스트용)
  const { data: allSections } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", planId)
    .order("section_order");

  let previousSections = "";
  if (allSections) {
    for (const s of allSections) {
      if (s.section_order < section.section_order && s.content) {
        previousSections += `\n## ${s.section_name}\n${s.content}\n`;
      }
    }
  }

  // 프로그램 정보
  let programInfo = "";
  if (plan.program_id) {
    const { data: program } = await supabase
      .from("programs")
      .select("*")
      .eq("id", plan.program_id)
      .single();
    if (program) {
      programInfo = `\n\n지원사업 정보:\n공고명: ${program.title}\n요약: ${program.summary || ""}\n대상: ${program.target || ""}`;
    }
  }

  const company = (plan as any).companies;
  const evaluationWeight = section.evaluation_weight || undefined;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let sectionContent = "";
        const adminSupabase = createAdminClient();

        for await (const chunk of streamClaude({
          model: "claude-sonnet-4-20250514",
          system: SECTION_WRITER_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildSectionWriterPrompt({
                sectionName: section.section_name,
                guidelines: section.guidelines || "",
                businessContent: company.business_content + programInfo,
                previousSections,
                evaluationWeight,
                researchKo: section.research_result_ko || undefined,
                researchEn: section.research_result_en || undefined,
              }),
            },
          ],
          temperature: 0.5,
          maxTokens: 2000,
        })) {
          sectionContent += chunk;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "chunk", data: { chunk } })}\n\n`
            )
          );
        }

        // DB 업데이트
        await adminSupabase
          .from("plan_sections")
          .update({
            content: sectionContent,
            content_formatted: sectionContent,
            generation_count: (section.generation_count || 0) + 1,
            is_edited: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", sectionId);

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "complete", data: { sectionId } })}\n\n`
          )
        );
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", data: { message: String(error) } })}\n\n`
          )
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
