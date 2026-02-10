/**
 * 사업계획서 자동 생성 파이프라인 — 3단계 공정 v4
 * Stage 0: 양식 인식 + 자동 분류 + 평가 기준 추출
 * Stage 1: 텍스트 초안 (선정 패턴 + 리서치 + 섹션별 작성)
 * Stage 1.5: 품질 검증 + 차트 데이터 추출
 * Stage 2: DOCX/PDF 내보내기 시 인포그래픽 반영 (export 단에서 처리)
 *
 * SSE 스트리밍으로 실시간 진행률 표시
 * ★ v4: 이어쓰기(Resume) 지원 — Vercel 60초 타임아웃 대응
 *   이미 작성된 섹션은 건너뛰고 미완성 섹션부터 이어서 생성
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude, streamClaude } from "@/lib/ai/claude";
import { sendKakaoNotification } from "@/lib/notification/notification-service";
import {
  extractPdfUrlFromProgram,
  downloadPdfAsBase64,
  ocrProgramPdf,
} from "@/lib/ocr/program-pdf-ocr";
import { searchReferences, formatReferenceExamples } from "@/lib/rag/search";
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
    let programAttachmentUrls: Record<string, any> | null = null;

    if (opts.programId) {
      const { data: program } = await supabase
        .from("programs")
        .select("*")
        .eq("id", opts.programId)
        .single();

      if (program) {
        programInfo = `공고명: ${program.title}\n요약: ${program.summary || ""}\n대상: ${program.target || ""}`;
        programAttachmentUrls = (program as any).attachment_urls;
      }
    }

    // ========================================
    // Pre-Stage: 양식 PDF 자동 OCR
    // ========================================
    if (!opts.templateOcrText && opts.programId && programAttachmentUrls) {
      try {
        const pdfUrl = extractPdfUrlFromProgram(programAttachmentUrls);
        if (pdfUrl) {
          yield {
            type: "progress",
            data: { step: "공고 양식 PDF 다운로드 중...", progress: 1 },
          };

          const pdfData = await downloadPdfAsBase64(pdfUrl);
          if (pdfData) {
            yield {
              type: "progress",
              data: { step: `양식 OCR 처리 중... (${(pdfData.sizeBytes / 1024).toFixed(0)}KB)`, progress: 2 },
            };

            const ocrText = await ocrProgramPdf(pdfData.base64);
            if (ocrText && ocrText.length > 100) {
              opts.templateOcrText = ocrText;
              console.log(`[PlanGen] 양식 OCR 완료: ${ocrText.length}자 추출`);

              // DB에 캐시 저장
              await supabase
                .from("business_plans")
                .update({ template_ocr_text: ocrText })
                .eq("id", opts.planId);

              yield {
                type: "progress",
                data: { step: `양식 OCR 완료 (${ocrText.length}자)`, progress: 3 },
              };
            } else {
              console.warn("[PlanGen] OCR 결과가 너무 짧음, 기본 섹션 사용");
            }
          }
        }
      } catch (e) {
        console.error("[PlanGen] 양식 OCR 실패 (계속 진행):", e);
        // OCR 실패는 비치명적 — 기본 섹션으로 폴백
      }
    }

    // ========================================
    // ★ 이어쓰기(Resume) 체크 — 기존 섹션 존재 시 건너뛰기
    // ========================================
    const { data: existingSections } = await supabase
      .from("plan_sections")
      .select("section_order, section_name, guidelines, content, evaluation_weight")
      .eq("plan_id", opts.planId)
      .order("section_order");

    const isResume = existingSections && existingSections.length > 0;
    const completedSections = new Set<number>();
    let previousSections = "";

    if (isResume) {
      // 이미 작성된 섹션 식별
      for (const es of existingSections!) {
        if (es.content && es.content.length > 100) {
          completedSections.add(es.section_order);
          previousSections += `\n## ${es.section_name}\n${es.content}\n`;
        }
      }
      console.log(`[PlanGen] 이어쓰기 모드: ${completedSections.size}/${existingSections!.length} 섹션 완료됨`);
    }

    // ========================================
    // Stage 0: 양식 인식 + 자동 분류
    // ========================================
    let templateType: TemplateType = "custom";

    // 이어쓰기 모드에서는 Stage 0 건너뛰기 (이미 분류됨)
    if (isResume) {
      // evaluation_criteria에서 template_type 복원
      const { data: planData } = await supabase
        .from("business_plans")
        .select("evaluation_criteria")
        .eq("id", opts.planId)
        .single();

      const evalCrit = (planData as any)?.evaluation_criteria;
      if (evalCrit?.template_type) {
        templateType = evalCrit.template_type as TemplateType;
      }

      yield {
        type: "progress",
        data: { step: `이어쓰기: ${completedSections.size}개 섹션 완료됨`, progress: 5 },
      };
    } else {
      yield {
        type: "progress",
        data: { step: "Stage 0: 양식 분류", progress: 3 },
      };

      if (opts.templateOcrText) {
        // 0-1. 양식 자동 분류 (Haiku — 빠름)
        try {
          const classifyResult = await callClaude({
            model: "claude-haiku-4-5-20251001",
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
    }

    // ========================================
    // Stage 0-2: 섹션 추출
    // ========================================
    let sections: Array<{
      section_name: string;
      guidelines: string;
      section_order: number;
    }>;

    if (isResume) {
      // 이어쓰기: DB에서 섹션 구조 복원
      sections = existingSections!.map((es: any) => ({
        section_name: es.section_name,
        guidelines: es.guidelines || "",
        section_order: es.section_order,
      }));
    } else if (opts.templateOcrText) {
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
          sections =
            TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
        }
      } catch {
        sections =
          TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
      }
    } else {
      sections =
        TEMPLATE_SECTIONS[templateType] || DEFAULT_SECTIONS;
    }

    yield {
      type: "progress",
      data: {
        step: isResume ? `이어쓰기: 미완성 ${sections.length - completedSections.size}개 섹션 생성 시작` : "섹션 구조 확정",
        progress: 10,
        totalSections: sections.length,
        templateType,
      },
    };

    // ========================================
    // Stage 0-3: 평가 기준 분석 (이어쓰기 시 건너뛰기)
    // ========================================
    if (!isResume) {
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
    } else {
      // 이어쓰기: evaluation_criteria 복원
      const { data: planData } = await supabase
        .from("business_plans")
        .select("evaluation_criteria")
        .eq("id", opts.planId)
        .single();
      const evalCrit = (planData as any)?.evaluation_criteria;
      if (evalCrit?.criteria) {
        evaluationCriteria = evalCrit.criteria;
      } else if (Array.isArray(evalCrit)) {
        evaluationCriteria = evalCrit;
      }
    }

    // 사업계획서 상태 업데이트
    await supabase
      .from("business_plans")
      .update({
        status: "generating",
        ...(!isResume ? {
          evaluation_criteria: evaluationCriteria,
          template_ocr_text: opts.templateOcrText || null,
        } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", opts.planId);

    // ========================================
    // Stage 1: 텍스트 초안 작성 (섹션별) — 이어쓰기 지원
    // ========================================
    const allChartData: any[] = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const progress = Math.round(12 + (i / sections.length) * 65);

      // ★ 이어쓰기: 이미 완료된 섹션 건너뛰기
      if (completedSections.has(section.section_order)) {
        yield {
          type: "section_done",
          data: {
            sectionName: section.section_name,
            sectionOrder: section.section_order,
            progress: Math.round(12 + ((i + 1) / sections.length) * 65),
            skipped: true,
          },
        };
        continue;
      }

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
          model: "claude-haiku-4-5-20251001",
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
            model: "claude-haiku-4-5-20251001",
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

      // Step B-2: RAG 레퍼런스 검색
      let referenceExamples: string | undefined;
      try {
        const ragQuery = `${section.section_name} ${(section.guidelines || "").slice(0, 200)}`;
        const ragResults = await searchReferences({
          query: ragQuery,
          templateType,
          referenceType: "business_plan",
          topK: 3,
        });
        if (ragResults.length > 0) {
          referenceExamples = formatReferenceExamples(ragResults);
          console.log(`[PlanGen] RAG search: ${ragResults.length}개 레퍼런스 (${section.section_name})`);
        }
      } catch (e) {
        console.warn(`[PlanGen] RAG 검색 실패 (계속 진행):`, e);
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
              referenceExamples,
            }),
          },
        ],
        temperature: 0.5,
        maxTokens: 8000, // 분량 대폭 확대 v4 (기존 3000 → 8000, 섹션당 3,500~6,000자 지원)
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
          model: "claude-haiku-4-5-20251001",
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
          model: "claude-haiku-4-5-20251001",
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
        model: "claude-haiku-4-5-20251001",
        system: KPI_EXTRACTOR_SYSTEM,
        messages: [
          {
            role: "user",
            content: `## 전체 사업계획서\n${previousSections.slice(0, 16000)}`,
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

    // 사업계획서 완료 카카오 알림톡 발송
    try {
      const { data: plan } = await supabase
        .from("business_plans")
        .select("title")
        .eq("id", opts.planId)
        .single();

      await sendKakaoNotification({
        userId: company.user_id,
        type: "plan_complete",
        variables: {
          "#{계획서명}": plan?.title || "사업계획서",
        },
      });
    } catch (e) {
      console.error("[PlanGen] 알림 발송 실패:", e);
    }

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
