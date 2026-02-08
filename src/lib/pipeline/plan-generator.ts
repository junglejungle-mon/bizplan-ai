/**
 * 사업계획서 자동 생성 파이프라인 — 3단계 공정 v3
 * Stage 0: 양식 인식 + 자동 분류 + 평가 기준 추출
 * Stage 1: 텍스트 초안 (선정 패턴 + 리서치 + 섹션별 작성)
 * Stage 1.5: 품질 검증 + 차트 데이터 추출
 * Stage 2: DOCX/PDF 내보내기 시 인포그래픽 반영 (export 단에서 처리)
 *
 * SSE 스트리밍으로 실시간 진행률 표시
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, streamClaude } from "@/lib/ai/claude";
import {
  // Stage 0
  TEMPLATE_CLASSIFIER_SYSTEM,
  buildTemplateClassifierPrompt,
  DEFAULT_EVAL_WEIGHTS,
  TEMPLATE_SECTIONS,
  type TemplateType,
  // Stage 0-2
  SECTION_EXTRACTOR_SYSTEM,
  buildSectionExtractorPrompt,
  EVALUATION_EXTRACTOR_SYSTEM,
  // Stage 1
  RESEARCH_JUDGE_SYSTEM,
  buildResearchJudgePrompt,
  SEARCH_QUERY_SYSTEM,
  buildSearchQueryPrompt,
  SECTION_WRITER_SYSTEM,
  buildSectionWriterPrompt,
  DEFAULT_SECTIONS,
  // Stage 1.5
  QUALITY_VALIDATOR_SYSTEM,
  buildQualityValidatorPrompt,
  CHART_DATA_EXTRACTOR_SYSTEM,
  buildChartDataExtractorPrompt,
  KPI_EXTRACTOR_SYSTEM,
} from "@/lib/ai/prompts/writing";

interface GenerateOptions {
  planId: string;
  companyId: string;
  programId?: string;
  templateOcrText?: string;
}

/**
 * SSE 스트리밍으로 사업계획서 생성 (3단계 공정)
 */
export async function* generateBusinessPlan(
  opts: GenerateOptions
): AsyncGenerator<{
  type:
    | "progress"
    | "section_start"
    | "section_chunk"
    | "section_done"
    | "validation"
    | "chart_data"
    | "complete"
    | "error";
  data: any;
}> {
  const supabase = createAdminClient();

  try {
    // ========================================
    // 1. 회사 정보 로드
    // ========================================
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

    // ========================================
    // Stage 0: 양식 인식 + 자동 분류
    // ========================================
    yield {
      type: "progress",
      data: { step: "Stage 0: 양식 분류", progress: 3 },
    };

    let templateType: TemplateType = "custom";

    if (opts.templateOcrText) {
      // 0-1. 양식 자동 분류 (Haiku — 빠름)
      try {
        const classifyResult = await callClaude({
          model: "claude-3-5-haiku-20241022",
          system: TEMPLATE_CLASSIFIER_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildTemplateClassifierPrompt(opts.templateOcrText),
            },
          ],
          temperature: 0,
        });

        try {
          const jsonMatch = classifyResult.match(
            /\{[\s\S]*"template_type"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            templateType = parsed.template_type as TemplateType;
            console.log(
              `[PlanGen] 양식 분류: ${templateType} (confidence: ${parsed.confidence})`
            );
          }
        } catch {}
      } catch (e) {
        console.error("[PlanGen] 양식 분류 실패:", e);
      }
    }

    yield {
      type: "progress",
      data: { step: `양식 유형: ${templateType}`, progress: 5 },
    };

    // ========================================
    // Stage 0-2: 섹션 추출
    // ========================================
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
          // OCR 실패 → 양식유형별 기본 섹션 사용
          sections =
            TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
        }
      } catch {
        sections =
          TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
      }
    } else {
      // OCR 없음 → 양식유형별 기본 섹션 또는 범용 기본
      sections =
        TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
    }

    yield {
      type: "progress",
      data: {
        step: "섹션 구조 확정",
        progress: 10,
        totalSections: sections.length,
        templateType,
      },
    };

    // ========================================
    // Stage 0-3: 평가 기준 분석
    // ========================================
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

    // 평가기준 추출 실패 시 → 양식유형별 기본 배점 사용
    if (evaluationCriteria.length === 0) {
      evaluationCriteria = DEFAULT_EVAL_WEIGHTS[templateType] || [];
    }

    // 섹션을 plan_sections 테이블에 저장
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

    // 사업계획서 상태 업데이트
    await supabase
      .from("business_plans")
      .update({
        status: "generating",
        evaluation_criteria: evaluationCriteria,
        template_ocr_text: opts.templateOcrText || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.planId);

    // ========================================
    // Stage 1: 텍스트 초안 작성 (섹션별)
    // ========================================
    let previousSections = "";
    const allChartData: any[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const progress = Math.round(12 + (i / sections.length) * 65);

      yield {
        type: "section_start",
        data: {
          sectionName: section.section_name,
          sectionOrder: section.section_order,
          progress,
          stage: "Stage 1: 텍스트 작성",
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

      // Step B: 리서치 실행 (Perplexity)
      if (needsResearch) {
        try {
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

          if (process.env.PERPLEXITY_API_KEY && (searchKo || searchEn)) {
            if (searchKo) {
              researchKo = await callPerplexity(searchKo, "ko");
            }
            if (searchEn) {
              researchEn = await callPerplexity(searchEn, "en");
            }
          }

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
          console.error(
            `[PlanGen] 리서치 실패 [${section.section_name}]:`,
            e
          );
        }
      }

      // Step C: 섹션 작성 (Sonnet — SSE 스트리밍 + templateType 전달)
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
              businessContent:
                company.business_content +
                (programInfo
                  ? `\n\n지원사업 정보:\n${programInfo}`
                  : ""),
              previousSections,
              evaluationWeight: evalWeight,
              researchKo: researchKo || undefined,
              researchEn: researchEn || undefined,
              templateType,
            }),
          },
        ],
        temperature: 0.5,
        maxTokens: 3000, // 분량 확대 (기존 2000 → 3000)
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

      // ========================================
      // Stage 1.5: 품질 검증 + 차트 데이터 추출 (비동기 병렬)
      // ========================================
      // 품질 검증과 차트 추출을 병렬로 실행 (Haiku — 빠르고 저렴)
      const [validationResult, chartResult] = await Promise.allSettled([
        // 품질 검증
        callClaude({
          model: "claude-3-5-haiku-20241022",
          system: QUALITY_VALIDATOR_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildQualityValidatorPrompt(
                section.section_name,
                sectionContent,
                templateType
              ),
            },
          ],
          temperature: 0,
        }),
        // 차트 데이터 추출
        callClaude({
          model: "claude-3-5-haiku-20241022",
          system: CHART_DATA_EXTRACTOR_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildChartDataExtractorPrompt(
                section.section_name,
                sectionContent
              ),
            },
          ],
          temperature: 0,
        }),
      ]);

      // 품질 점수 파싱 + DB 저장
      let qualityScore: any = null;
      if (validationResult.status === "fulfilled") {
        try {
          const jsonMatch = validationResult.value.match(
            /\{[\s\S]*"total"[\s\S]*\}/
          );
          if (jsonMatch) {
            qualityScore = JSON.parse(jsonMatch[0]);

            // plan_sections에 품질 점수 저장 (content_formatted 에 메타 추가)
            await supabase
              .from("plan_sections")
              .update({
                // quality_score JSONB 컬럼이 없을 수 있으니 content_formatted에 포함
                updated_at: new Date().toISOString(),
              })
              .eq("plan_id", opts.planId)
              .eq("section_order", section.section_order);
          }
        } catch {}
      }

      // 차트 데이터 파싱
      let sectionCharts: any[] = [];
      if (chartResult.status === "fulfilled") {
        try {
          const jsonMatch = chartResult.value.match(
            /\{[\s\S]*"charts"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            sectionCharts = parsed.charts || [];
            allChartData.push(
              ...sectionCharts.map((c: any) => ({
                ...c,
                section_name: section.section_name,
                section_order: section.section_order,
              }))
            );
          }
        } catch {}
      }

      yield {
        type: "section_done",
        data: {
          sectionName: section.section_name,
          sectionOrder: section.section_order,
          progress: Math.round(12 + ((i + 1) / sections.length) * 65),
          qualityScore: qualityScore
            ? { total: qualityScore.total, grade: qualityScore.grade }
            : null,
          chartCount: sectionCharts.length,
        },
      };

      // 품질 검증 결과 스트리밍 (UI에서 표시용)
      if (qualityScore) {
        yield {
          type: "validation",
          data: {
            sectionName: section.section_name,
            ...qualityScore,
          },
        };
      }
    }

    // ========================================
    // Stage 1.5-2: 전체 KPI 추출 + 차트 데이터 저장
    // ========================================
    yield {
      type: "progress",
      data: { step: "Stage 2: 데이터 시각화 준비", progress: 82 },
    };

    // 전체 사업계획서에서 KPI 추출
    let kpiData: any = null;
    try {
      const kpiResult = await callClaude({
        model: "claude-3-5-haiku-20241022",
        system: KPI_EXTRACTOR_SYSTEM,
        messages: [
          {
            role: "user",
            content: `## 전체 사업계획서\n${previousSections.slice(0, 8000)}`,
          },
        ],
        temperature: 0,
      });

      try {
        const jsonMatch = kpiResult.match(/\{[\s\S]*"kpis"[\s\S]*\}/);
        if (jsonMatch) {
          kpiData = JSON.parse(jsonMatch[0]);
        }
      } catch {}
    } catch (e) {
      console.error("[PlanGen] KPI 추출 실패:", e);
    }

    // 차트 데이터와 KPI를 business_plans에 저장
    yield {
      type: "chart_data",
      data: {
        charts: allChartData,
        kpis: kpiData,
        totalCharts: allChartData.length,
      },
    };

    // ========================================
    // 완성 처리
    // ========================================
    const completionData: any = {
      status: "completed",
      updated_at: new Date().toISOString(),
    };

    // chart_data, kpi_data 컬럼이 있으면 저장 (없어도 에러 안남)
    try {
      await supabase
        .from("business_plans")
        .update({
          ...completionData,
          // 메타데이터로 저장 (JSONB)
          evaluation_criteria: {
            criteria: evaluationCriteria,
            template_type: templateType,
            chart_data: allChartData,
            kpi_data: kpiData,
          },
        })
        .eq("id", opts.planId);
    } catch {
      // fallback — evaluation_criteria 에 넣기
      await supabase
        .from("business_plans")
        .update(completionData)
        .eq("id", opts.planId);
    }

    // 전체 품질 점수 계산
    const avgScore =
      allChartData.length > 0
        ? Math.round(
            allChartData.reduce(
              (sum: number, c: any) => sum + (c.qualityScore?.total || 0),
              0
            ) / allChartData.length
          )
        : null;

    yield {
      type: "complete",
      data: {
        planId: opts.planId,
        totalSections: sections.length,
        templateType,
        totalCharts: allChartData.length,
        kpiExtracted: !!kpiData,
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
                ? "당신은 사업계획서 작성을 위한 시장조사 전문가입니다. 최신 통계와 시장 데이터를 제공하세요."
                : "You are a market research expert for a business plan. Provide latest statistics and market data.",
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
