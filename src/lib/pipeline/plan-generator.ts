/**
 * 사업계획서 자동 생성 파이프라인
 * SSE 스트리밍으로 실시간 진행률 표시
 */

import { createClient } from "@/lib/supabase/server";
import { callClaude, streamClaude } from "@/lib/ai/claude";
import {
  SECTION_EXTRACTOR_SYSTEM,
  buildSectionExtractorPrompt,
  EVALUATION_EXTRACTOR_SYSTEM,
  RESEARCH_JUDGE_SYSTEM,
  buildResearchJudgePrompt,
  SEARCH_QUERY_SYSTEM,
  buildSearchQueryPrompt,
  SECTION_WRITER_SYSTEM,
  buildSectionWriterPrompt,
  DEFAULT_SECTIONS,
} from "@/lib/ai/prompts/writing";

interface GenerateOptions {
  planId: string;
  companyId: string;
  programId?: string;
  templateOcrText?: string;
}

/**
 * SSE 스트리밍으로 사업계획서 생성
 */
export async function* generateBusinessPlan(
  opts: GenerateOptions
): AsyncGenerator<{
  type: "progress" | "section_start" | "section_chunk" | "section_done" | "complete" | "error";
  data: any;
}> {
  const supabase = await createClient();

  try {
    // 1. 회사 정보 로드
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", opts.companyId)
      .single();

    if (!company) throw new Error("회사를 찾을 수 없습니다");

    // 2. 프로그램 정보 로드 (있는 경우)
    let programInfo = "";
    let evaluationCriteria: any[] = [];

    if (opts.programId) {
      const { data: program } = await supabase
        .from("programs")
        .select("*")
        .eq("id", opts.programId)
        .single();

      if (program) {
        programInfo = `공고명: ${program.title}\n요약: ${program.summary || ""}\n대상: ${program.target || ""}`;
      }
    }

    yield {
      type: "progress",
      data: { step: "양식 분석", progress: 5 },
    };

    // 3. 섹션 구조 결정
    let sections: Array<{
      section_name: string;
      guidelines: string;
      section_order: number;
    }>;

    if (opts.templateOcrText) {
      // OCR된 양식에서 섹션 추출
      const extractResult = await callClaude({
        model: "claude-sonnet-4-20250514",
        system: SECTION_EXTRACTOR_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildSectionExtractorPrompt(opts.templateOcrText),
          },
        ],
        temperature: 0.2,
      });

      try {
        const jsonMatch = extractResult.match(
          /\{[\s\S]*"sections"[\s\S]*\}/
        );
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          sections = parsed.sections;
        } else {
          sections = DEFAULT_SECTIONS;
        }
      } catch {
        sections = DEFAULT_SECTIONS;
      }
    } else {
      sections = DEFAULT_SECTIONS;
    }

    yield {
      type: "progress",
      data: {
        step: "섹션 구조 확정",
        progress: 10,
        totalSections: sections.length,
      },
    };

    // 4. 평가 기준 분석 (공고문이 있는 경우)
    if (programInfo) {
      try {
        const evalResult = await callClaude({
          model: "claude-sonnet-4-20250514",
          system: EVALUATION_EXTRACTOR_SYSTEM,
          messages: [
            {
              role: "user",
              content: `공고 정보:\n${programInfo}\n\n${opts.templateOcrText ? `양식:\n${opts.templateOcrText.slice(0, 3000)}` : ""}`,
            },
          ],
          temperature: 0.2,
        });

        try {
          const jsonMatch = evalResult.match(
            /\{[\s\S]*"criteria"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            evaluationCriteria = parsed.criteria || [];
          }
        } catch {}
      } catch {}
    }

    // 5. 섹션을 plan_sections 테이블에 저장
    for (const section of sections) {
      const evalWeight =
        evaluationCriteria.find(
          (c: any) =>
            section.section_name.includes(c.항목) ||
            c.항목.includes(section.section_name)
        )?.배점 || null;

      await supabase.from("plan_sections").insert({
        plan_id: opts.planId,
        section_name: section.section_name,
        guidelines: section.guidelines,
        section_order: section.section_order,
        evaluation_weight: evalWeight,
      });
    }

    // 6. 사업계획서 상태 업데이트
    await supabase
      .from("business_plans")
      .update({
        status: "generating",
        evaluation_criteria: evaluationCriteria,
        template_ocr_text: opts.templateOcrText || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.planId);

    // 7. 섹션별 자동 작성 (반복)
    let previousSections = "";

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const progress = Math.round(15 + (i / sections.length) * 80);

      yield {
        type: "section_start",
        data: {
          sectionName: section.section_name,
          sectionOrder: section.section_order,
          progress,
        },
      };

      // Step A: 리서치 필요 여부 판단
      let needsResearch = false;
      let researchKo = "";
      let researchEn = "";

      try {
        const judgeResult = await callClaude({
          model: "claude-3-5-haiku-20241022",
          system: RESEARCH_JUDGE_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildResearchJudgePrompt(
                section.section_name,
                section.guidelines,
                company.business_content
              ),
            },
          ],
          temperature: 0,
        });

        try {
          const jsonMatch = judgeResult.match(
            /\{[\s\S]*"needs_research"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            needsResearch = parsed.needs_research === 1;
          }
        } catch {}
      } catch {}

      // Step B: 리서치 실행 (Perplexity — TODO: Phase 3에서 연동)
      if (needsResearch) {
        try {
          // 검색 쿼리 생성
          const queryResult = await callClaude({
            model: "claude-3-5-haiku-20241022",
            system: SEARCH_QUERY_SYSTEM,
            messages: [
              {
                role: "user",
                content: buildSearchQueryPrompt(
                  section.section_name,
                  section.guidelines,
                  company.business_content
                ),
              },
            ],
            temperature: 0.3,
          });

          let searchKo = "";
          let searchEn = "";
          try {
            const jsonMatch = queryResult.match(/\{[\s\S]*"ko"[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              searchKo = parsed.ko || "";
              searchEn = parsed.en || "";
            }
          } catch {}

          // Perplexity 리서치 (API 키가 있는 경우에만)
          if (process.env.PERPLEXITY_API_KEY && (searchKo || searchEn)) {
            if (searchKo) {
              researchKo = await callPerplexity(searchKo, "ko");
            }
            if (searchEn) {
              researchEn = await callPerplexity(searchEn, "en");
            }
          }

          // DB에 리서치 정보 저장
          await supabase
            .from("plan_sections")
            .update({
              needs_research: true,
              research_query_ko: searchKo,
              research_query_en: searchEn,
              research_result_ko: researchKo,
              research_result_en: researchEn,
            })
            .eq("plan_id", opts.planId)
            .eq("section_order", section.section_order);
        } catch (e) {
          console.error(`[PlanGen] 리서치 실패 [${section.section_name}]:`, e);
        }
      }

      // Step C: 섹션 작성 (Sonnet — SSE 스트리밍)
      const evalWeight =
        evaluationCriteria.find(
          (c: any) =>
            section.section_name.includes(c.항목) ||
            c.항목.includes(section.section_name)
        )?.배점 || undefined;

      let sectionContent = "";

      for await (const chunk of streamClaude({
        model: "claude-sonnet-4-20250514",
        system: SECTION_WRITER_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildSectionWriterPrompt({
              sectionName: section.section_name,
              guidelines: section.guidelines,
              businessContent: company.business_content + (programInfo ? `\n\n지원사업 정보:\n${programInfo}` : ""),
              previousSections,
              evaluationWeight: evalWeight,
              researchKo: researchKo || undefined,
              researchEn: researchEn || undefined,
            }),
          },
        ],
        temperature: 0.5,
        maxTokens: 2000,
      })) {
        sectionContent += chunk;
        yield {
          type: "section_chunk",
          data: {
            sectionName: section.section_name,
            chunk,
          },
        };
      }

      // DB에 작성된 내용 저장
      await supabase
        .from("plan_sections")
        .update({
          content: sectionContent,
          content_formatted: sectionContent,
          generation_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("plan_id", opts.planId)
        .eq("section_order", section.section_order);

      previousSections += `\n## ${section.section_name}\n${sectionContent}\n`;

      yield {
        type: "section_done",
        data: {
          sectionName: section.section_name,
          sectionOrder: section.section_order,
          progress: Math.round(15 + ((i + 1) / sections.length) * 80),
        },
      };
    }

    // 8. 완성 처리
    await supabase
      .from("business_plans")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.planId);

    yield {
      type: "complete",
      data: {
        planId: opts.planId,
        totalSections: sections.length,
        progress: 100,
      },
    };
  } catch (error) {
    yield {
      type: "error",
      data: { message: String(error) },
    };
  }
}

/**
 * Perplexity API 호출
 */
async function callPerplexity(
  query: string,
  lang: "ko" | "en"
): Promise<string> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) return "";

  try {
    const response = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          {
            role: "system",
            content:
              lang === "ko"
                ? "당신은 사업계획서 작성을 위한 시장조사 전문가입니다."
                : "You are a market research expert for a business plan.",
          },
          { role: "user", content: query },
        ],
        temperature: 0.2,
        return_citations: true,
        search_recency_filter: "month",
      }),
    });

    if (!response.ok) return "";

    const data = await response.json();
    return data.choices?.[0]?.message?.content || "";
  } catch {
    return "";
  }
}
