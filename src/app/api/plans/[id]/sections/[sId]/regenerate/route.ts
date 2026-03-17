import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { streamClaudeAPI as streamClaude } from "@/lib/ai/claude";
import {
  SECTION_WRITER_SYSTEM,
  buildSectionWriterPrompt,
} from "@/lib/ai/prompts/writing";
import { searchReferences, formatReferenceExamples } from "@/lib/rag/search";
import { incrementUsage } from "@/lib/payment/usage";

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

  // 사용량 체크 (무료: 3회/월, 유료: 플랜별 제한)
  const usageResult = await incrementUsage(user.id, "section_regenerations");
  if (!usageResult.allowed) {
    return Response.json(
      {
        error: "이번 달 섹션 재생성 한도를 초과했습니다.",
        code: "USAGE_LIMIT_EXCEEDED",
        current: usageResult.current,
        limit: usageResult.limit,
        upgradeUrl: "/pricing",
      },
      { status: 429 }
    );
  }

  // 사용자 프롬프트 (선택적)
  let userPrompt: string | undefined;
  try {
    const body = await request.json();
    userPrompt = body.userPrompt || undefined;
  } catch {
    // body가 없으면 무시 (기존 호환)
  }

  // 사업계획서 + 회사 정보 로드
  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, companies!inner(*, user_id)")
    .eq("id", planId)
    .single();

  const planCompanies = plan ? (plan as { companies?: { user_id?: string; business_content?: string; [key: string]: unknown } }).companies : undefined;
  if (!plan || planCompanies?.user_id !== user.id) {
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

  const company = planCompanies;
  const evaluationWeight = section.evaluation_weight || undefined;

  // RAG 레퍼런스 검색
  let referenceExamples: string | undefined;
  try {
    const ragQuery = `${section.section_name} ${(section.guidelines || "").slice(0, 200)}`;
    const evalCrit = (plan as { evaluation_criteria?: { template_type?: string } }).evaluation_criteria;
    const templateType = evalCrit?.template_type || undefined;
    const ragResults = await searchReferences({
      query: ragQuery,
      templateType,
      referenceType: "business_plan",
      topK: 3,
    });
    if (ragResults.length > 0) {
      referenceExamples = formatReferenceExamples(ragResults);
    }
  } catch (e) {
    console.warn("[Regenerate] RAG 검색 실패 (계속 진행):", e);
  }

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
                referenceExamples,
                userPrompt,
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
            `data: ${JSON.stringify({ type: "error", data: { message: "재생성 중 오류가 발생했습니다" } })}\n\n`
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
