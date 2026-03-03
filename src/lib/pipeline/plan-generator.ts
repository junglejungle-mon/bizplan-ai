/**
 * 사업계획서 자동 생성 파이프라인 — 3단계 공정 v5
 * Stage 0: 양식 인식 + 자동 분류 + 평가 기준 추출
 * Stage 1: 텍스트 초안 (선정 패턴 + 리서치 + 섹션별 작성)
 *          ★ v5: 06-CFO 재무팀 에이전트 통합 — 재무 섹션 전문가 품질
 *          ★ v6: 09-사업개발 + 02-마케팅 + 12-제품개발 에이전트 통합
 * Stage 1.5: 품질 검증 + 차트 데이터 추출
 * Stage 2: DOCX/PDF 내보내기 시 인포그래픽 반영 (export 단에서 처리)
 *
 * SSE 스트리밍으로 실시간 진행률 표시
 * ★ v4: 이어쓰기(Resume) 지원 — Vercel 60초 타임아웃 대응
 *   이미 작성된 섹션은 건너뛰고 미완성 섹션부터 이어서 생성
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeAPI as callClaude, streamClaudeAPI as streamClaude } from "@/lib/ai/claude";
import { sendKakaoNotification } from "@/lib/notification/notification-service";
import {
  extractPdfUrlFromProgram,
  downloadPdfAsBase64,
  ocrProgramPdf,
} from "@/lib/ocr/program-pdf-ocr";
import { searchReferences, formatReferenceExamples } from "@/lib/rag/search";
import { scoreAndSave } from "@/lib/quality/scorer";
import { buildDynamicWriterContext } from "@/lib/quality/pattern-loader";
import {
  classifyFinanceSection,
  buildCFOCoreContext,
  buildCFOEnhancedContext,
  extractFinancialDataFromContent,
  CFO_FINANCE_SYSTEM,
} from "@/lib/agents/finance-agent";
import {
  classifyBizDevSection,
  buildBizDevContext,
} from "@/lib/agents/bizdev-agent";
import {
  classifyMarketSection,
  buildMarketContext,
  MARKET_INTELLIGENCE_SYSTEM,
  extractMarketDataFromContent,
} from "@/lib/agents/market-agent";
import {
  classifyTechSection,
  buildTechContext,
  TECH_STRATEGY_SYSTEM,
} from "@/lib/agents/tech-agent";
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
  RESEARCH_JUDGE_WITH_QUERY_SYSTEM,
  buildResearchJudgeWithQueryPrompt,
  SECTION_WRITER_SYSTEM,
  buildSectionWriterPrompt,
  DEFAULT_SECTIONS,
  // Stage 1.5
  QUALITY_AND_CHART_SYSTEM,
  buildQualityAndChartPrompt,
  KPI_EXTRACTOR_SYSTEM,
} from "@/lib/ai/prompts/writing";

/**
 * 시장 데이터 신뢰도 스코어 계산
 * Perplexity 리서치 결과의 품질을 평가하여 계획서 품질 향상에 반영
 */
function calculateMarketDataConfidence(researchData: string): {
  score: number; // 0-100
  factors: string[];
} {
  const factors: string[] = [];
  let score = 50; // 기본 점수

  // 1. 수치 데이터 포함 여부 (%, 원, 억 등)
  const numericPatterns = /(\d+[%만억원조달러]|\d+\.\d+%|\d{1,3}(,\d{3})+)/g;
  const numericMatches = researchData.match(numericPatterns);
  if (numericMatches && numericMatches.length >= 3) {
    score += 15;
    factors.push(`수치 데이터 ${numericMatches.length}건 발견`);
  } else if (numericMatches && numericMatches.length >= 1) {
    score += 5;
    factors.push(`수치 데이터 ${numericMatches.length}건 발견 (부족)`);
  }

  // 2. 연도 정보 포함 (최신성)
  const currentYear = new Date().getFullYear();
  const yearPatterns = new RegExp(`(${currentYear}|${currentYear - 1})년?`, "g");
  const yearMatches = researchData.match(yearPatterns);
  if (yearMatches && yearMatches.length >= 2) {
    score += 15;
    factors.push("최신 연도 데이터 포함");
  }

  // 3. 출처 언급 여부
  const sourcePatterns = /(통계청|산업통상자원부|중소벤처기업부|한국은행|KOSIS|NICE|KDI|KOTRA|과학기술정보통신부|국토교통부)/g;
  const sourceMatches = researchData.match(sourcePatterns);
  if (sourceMatches) {
    score += 10;
    factors.push(`공식 출처 ${new Set(sourceMatches).size}곳 인용`);
  }

  // 4. 시장 규모/성장률 관련 키워드
  const marketKeywords = /(시장 규모|CAGR|성장률|시장 점유율|전년 대비|market size|YoY)/gi;
  const marketMatches = researchData.match(marketKeywords);
  if (marketMatches && marketMatches.length >= 2) {
    score += 10;
    factors.push("시장 분석 핵심 지표 포함");
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    factors,
  };
}

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
  data: Record<string, unknown>;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let evaluationCriteria: Array<{ 항목: string; 배점: number; [key: string]: any }> = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let programAttachmentUrls: Record<string, any> | null = null;

    if (opts.programId) {
      const { data: program } = await supabase
        .from("programs")
        .select("*")
        .eq("id", opts.programId)
        .single();

      if (program) {
        // 프로그램 정보 최대한 풍부하게 구성 (매칭 정확도 + 계획서 일치성 핵심)
        const programParts = [
          `공고명: ${program.title}`,
          program.institution ? `주관기관: ${program.institution}` : "",
          program.summary ? `공고 요약: ${program.summary}` : "",
          program.target ? `지원대상/자격요건: ${program.target}` : "",
          (program as { hashtags?: string[] }).hashtags?.length ? `분야 키워드: ${(program as { hashtags?: string[] }).hashtags!.join(", ")}` : "",
          (program as { apply_start?: string }).apply_start ? `접수기간: ${(program as { apply_start?: string }).apply_start} ~ ${(program as { apply_end?: string }).apply_end || "미정"}` : "",
        ].filter(Boolean);

        // raw_data에서 추가 정보 추출 (지원금액, 상세 자격요건 등)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rawData = (program as { raw_data?: Record<string, any> }).raw_data;
        if (rawData) {
          if (rawData.support_amount || rawData.지원규모 || rawData.지원금액) {
            programParts.push(`지원금액/규모: ${rawData.support_amount || rawData.지원규모 || rawData.지원금액}`);
          }
          if (rawData.support_detail || rawData.지원내용) {
            programParts.push(`지원내용: ${(rawData.support_detail || rawData.지원내용 || "").slice(0, 500)}`);
          }
          if (rawData.evaluation_criteria || rawData.평가기준) {
            programParts.push(`평가기준: ${(rawData.evaluation_criteria || rawData.평가기준 || "").slice(0, 500)}`);
          }
        }

        programInfo = programParts.join("\n");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        programAttachmentUrls = (program as { attachment_urls?: Record<string, any> | null }).attachment_urls ?? null;
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evalCrit = (planData as { evaluation_criteria?: Record<string, any> } | null)?.evaluation_criteria;
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
      sections = existingSections!.map((es) => ({
        section_name: es.section_name,
        guidelines: es.guidelines || "",
        section_order: es.section_order,
      }));
    } else if (opts.templateOcrText) {
      // OCR된 양식에서 섹션 추출
      const extractResult = await callClaude({
        model: "claude-haiku-4-5-20251001",
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
            model: "claude-haiku-4-5-20251001",
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
            (c) =>
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const evalCrit = (planData as { evaluation_criteria?: Record<string, any> } | null)?.evaluation_criteria;
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

    // DB에서 선정패턴 + 평가기준 로드 (프롬프트 주입용)
    let dynamicWriterContext = "";
    try {
      dynamicWriterContext = await buildDynamicWriterContext(templateType);
    } catch (e) {
      console.warn("[PlanGen] DB 패턴 로드 실패 (하드코딩 폴백 사용):", e);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const allChartData: Array<Record<string, any>> = [];

    // ★ v5: 재무 수치 일관성 추적 — CFO 내부감사 에이전트
    let accumulatedFinancialData = "";

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

      // Step A+B 통합: 리서치 판단 + 검색 쿼리 생성 (1회 호출)
      try {
        const judgeResult = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: RESEARCH_JUDGE_WITH_QUERY_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildResearchJudgeWithQueryPrompt(
                section.section_name,
                section.guidelines,
                company.business_content
              ),
            },
          ],
          temperature: 0.1,
        });

        try {
          const jsonMatch = judgeResult.match(
            /\{[\s\S]*"needs_research"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            needsResearch = parsed.needs_research === 1;

            if (needsResearch) {
              const searchKo = parsed.ko || "";
              const searchEn = parsed.en || "";

              // Perplexity 한글/영문 병렬 호출
              if (process.env.PERPLEXITY_API_KEY && (searchKo || searchEn)) {
                const perplexityTasks: Promise<string>[] = [];
                const taskLabels: string[] = [];
                if (searchKo) {
                  perplexityTasks.push(callPerplexity(searchKo, "ko"));
                  taskLabels.push("ko");
                }
                if (searchEn) {
                  perplexityTasks.push(callPerplexity(searchEn, "en"));
                  taskLabels.push("en");
                }
                const results = await Promise.allSettled(perplexityTasks);
                results.forEach((r, i) => {
                  if (r.status === "fulfilled") {
                    if (taskLabels[i] === "ko") researchKo = r.value;
                    else researchEn = r.value;
                  }
                });
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
            }
          }
        } catch {}
      } catch (e) {
        console.error(
          `[PlanGen] 리서치 판단+쿼리 실패 [${section.section_name}]:`,
          e
        );
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
        }
      } catch (e) {
        console.warn(`[PlanGen] RAG 검색 실패 (계속 진행):`, e);
      }

      // Step C: 섹션 작성 (Sonnet — SSE 스트리밍 + templateType 전달)
      const evalWeight =
        evaluationCriteria.find(
          (c) =>
            section.section_name.includes(c.항목) ||
            c.항목.includes(section.section_name)
        )?.배점 || undefined;

      let sectionContent = "";

      // 시스템 프롬프트에 DB 패턴 동적 주입
      let writerSystem = dynamicWriterContext
        ? `${SECTION_WRITER_SYSTEM}\n\n${dynamicWriterContext}`
        : SECTION_WRITER_SYSTEM;

      // ★ v5: CFO 재무팀 에이전트 컨텍스트 주입
      const financeType = classifyFinanceSection(section.section_name);
      if (financeType === "core") {
        // 직접적 재무/예산 섹션 → CFO 전문가 시스템 + 상세 지침
        writerSystem = `${CFO_FINANCE_SYSTEM}\n\n${writerSystem}`;
        writerSystem += buildCFOCoreContext({
          sectionName: section.section_name,
          companyIndustry: company.business_content?.slice(0, 100),
          previousFinancialData: accumulatedFinancialData || undefined,
        });
      } else if (financeType === "enhanced") {
        // 간접 관련 섹션 → 경량 재무 수치 신뢰성 강화
        writerSystem += buildCFOEnhancedContext({
          sectionName: section.section_name,
          previousFinancialData: accumulatedFinancialData || undefined,
        });
      }

      // ★ v6: 사업개발(CBDO) 에이전트 — 설득력/평가위원 관점 강화
      const bizDevType = classifyBizDevSection(section.section_name);
      if (bizDevType) {
        writerSystem += buildBizDevContext({
          sectionName: section.section_name,
          previousSections: previousSections || undefined,
        });
      }

      // ★ v6: 시장 인텔리전스(CMO+CDO+CGO) — 시장/마케팅/글로벌 강화
      const marketType = classifyMarketSection(section.section_name);
      if (marketType) {
        writerSystem = `${MARKET_INTELLIGENCE_SYSTEM}\n\n${writerSystem}`;
        writerSystem += buildMarketContext({
          sectionName: section.section_name,
          companyIndustry: company.business_content?.slice(0, 100),
        });
      }

      // ★ v6: 기술/R&D(CPO+CSO) — 기술/제품/연구개발 섹션 강화
      const techType = classifyTechSection(section.section_name);
      if (techType) {
        writerSystem = `${TECH_STRATEGY_SYSTEM}\n\n${writerSystem}`;
        writerSystem += buildTechContext({
          sectionName: section.section_name,
          companyIndustry: company.business_content?.slice(0, 100),
        });
      }

      for await (const chunk of streamClaude({
        model: "claude-haiku-4-5-20251001",
        system: writerSystem,
        messages: [
          {
            role: "user",
            content: buildSectionWriterPrompt({
              sectionName: section.section_name,
              guidelines: section.guidelines,
              businessContent: company.business_content,
              programInfo: programInfo || undefined,
              previousSections,
              evaluationWeight: evalWeight,
              researchKo: researchKo || undefined,
              researchEn: researchEn || undefined,
              templateType,
              referenceExamples,
              evaluationCriteria: evaluationCriteria.length > 0 ? evaluationCriteria : undefined,
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
      const { data: savedSection } = await supabase
        .from("plan_sections")
        .update({
          content: sectionContent,
          content_formatted: sectionContent,
          generation_count: 1,
          updated_at: new Date().toISOString(),
        })
        .eq("plan_id", opts.planId)
        .eq("section_order", section.section_order)
        .select("id")
        .single();

      previousSections += `\n## ${section.section_name}\n${sectionContent}\n`;

      // ★ v5: 재무 수치 누적 추출 — 후속 섹션 일관성 유지 (내부감사 에이전트)
      const newFinancialData = extractFinancialDataFromContent(sectionContent);
      if (newFinancialData) {
        accumulatedFinancialData += (accumulatedFinancialData ? "\n" : "") +
          `[${section.section_name}] ${newFinancialData}`;
      }

      // ★ v6: 시장 데이터 누적 추출 — 시장 수치 일관성 유지
      const newMarketData = extractMarketDataFromContent(sectionContent);
      if (newMarketData) {
        accumulatedFinancialData += (accumulatedFinancialData ? "\n" : "") +
          `[${section.section_name}:시장] ${newMarketData}`;
      }

      // ========================================
      // Stage 1.5: 품질 검증 + 차트 데이터 추출 + 자동 채점 (비동기 병렬)
      // ========================================
      // 품질 검증, 차트 추출, 자동 채점을 병렬로 실행
      const sectionId = savedSection?.id;

      // Stage 1.5: 품질검증+차트추출 통합 (1회 AI) + 자동채점 (regex) 병렬
      const [qualityChartResult, scorerResult] = await Promise.allSettled([
        // 품질 검증 + 차트 데이터 추출 통합 (1회 호출)
        callClaude({
          model: "claude-haiku-4-5-20251001",
          system: QUALITY_AND_CHART_SYSTEM,
          messages: [
            {
              role: "user",
              content: buildQualityAndChartPrompt(
                section.section_name,
                sectionContent,
                templateType
              ),
            },
          ],
          temperature: 0,
        }),
        // 자동 채점 (regex 기반, DB 저장 — AI 호출 없음)
        sectionId
          ? scoreAndSave(opts.planId, sectionId, sectionContent, section.section_name)
          : Promise.resolve(null),
      ]);

      // 통합 결과에서 품질 + 차트 분리 파싱
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let qualityScore: Record<string, any> | null = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let chartData: Array<Record<string, any>> | null = null;
      if (qualityChartResult.status === "fulfilled") {
        try {
          const jsonMatch = qualityChartResult.value.match(
            /\{[\s\S]*"quality"[\s\S]*"charts"[\s\S]*\}/
          );
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            qualityScore = parsed.quality || null;
            chartData = parsed.charts || null;

            await supabase
              .from("plan_sections")
              .update({
                updated_at: new Date().toISOString(),
              })
              .eq("plan_id", opts.planId)
              .eq("section_order", section.section_order);
          }
        } catch {}
      }

      // 자동 채점 결과 로깅 + 재작성 루프
      let autoScore: number | null = null;
      if (scorerResult.status === "fulfilled" && scorerResult.value) {
        autoScore = scorerResult.value.total_score;

        // ★ 40점 미만이면 자동 재작성 1회 시도 (비용 최적화: 60→40)
        if (autoScore < 40 && sectionId) {
          const suggestions = scorerResult.value.improvement_suggestions || [];

          try {
            const rewritePrompt = buildSectionWriterPrompt({
              sectionName: section.section_name,
              guidelines: section.guidelines,
              businessContent: company.business_content,
              programInfo: programInfo || undefined,
              previousSections,
              evaluationWeight: evalWeight,
              researchKo: researchKo || undefined,
              researchEn: researchEn || undefined,
              templateType,
              referenceExamples,
            });

            const improvementGuide = suggestions.length > 0
              ? `\n\n## ⚠️ 이전 작성 품질 개선 필요 (${autoScore}점/100)\n다음 사항을 반드시 보완하세요:\n${suggestions.map((s: string, idx: number) => `${idx + 1}. ${s}`).join("\n")}\n\n이전 작성 내용을 참고하되, 위 피드백을 반영하여 더 높은 품질로 다시 작성하세요.\n\n### 이전 작성 내용 (참고용):\n${sectionContent.slice(0, 2000)}...`
              : "";

            let rewrittenContent = "";
            for await (const chunk of streamClaude({
              model: "claude-haiku-4-5-20251001",
              system: writerSystem,
              messages: [
                {
                  role: "user",
                  content: rewritePrompt + improvementGuide,
                },
              ],
              temperature: 0.5,
              maxTokens: 8000,
            })) {
              rewrittenContent += chunk;
              yield {
                type: "section_chunk",
                data: {
                  sectionName: section.section_name,
                  chunk,
                  isRewrite: true,
                },
              };
            }

            // 재작성 내용 재채점
            const rewriteScore = await scoreAndSave(
              opts.planId,
              sectionId,
              rewrittenContent,
              section.section_name
            );

            const newScore = rewriteScore.total_score;

            // 더 높은 점수 버전 사용
            if (newScore > autoScore) {
              sectionContent = rewrittenContent;
              autoScore = newScore;

              // DB 업데이트
              await supabase
                .from("plan_sections")
                .update({
                  content: rewrittenContent,
                  content_formatted: rewrittenContent,
                  generation_count: 2,
                  updated_at: new Date().toISOString(),
                })
                .eq("plan_id", opts.planId)
                .eq("section_order", section.section_order);

              // previousSections 업데이트 (마지막 추가된 섹션 교체)
              const lastSectionIdx = previousSections.lastIndexOf(`\n## ${section.section_name}\n`);
              if (lastSectionIdx >= 0) {
                previousSections = previousSections.slice(0, lastSectionIdx) + `\n## ${section.section_name}\n${rewrittenContent}\n`;
              }

            }
          } catch (e) {
            console.error(`[PlanGen] 재작성 실패 [${section.section_name}]:`, e);
          }
        }
      } else if (scorerResult.status === "rejected") {
        console.warn(`[PlanGen] 자동 채점 실패 [${section.section_name}]:`, scorerResult.reason);
      }

      // 차트 데이터 (통합 결과에서 이미 파싱됨)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let sectionCharts: Array<Record<string, any>> = [];
      if (chartData && Array.isArray(chartData)) {
        sectionCharts = chartData;
        allChartData.push(
          ...sectionCharts.map((c) => ({
            ...c,
            section_name: section.section_name,
            section_order: section.section_order,
          }))
        );
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
          autoScore,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let kpiData: Record<string, any> | null = null;
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
    const completionData = {
      status: "completed" as const,
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

    // 전체 품질 점수 계산 (scorer로 전체 플랜 평균 계산 + DB 저장)
    try {
      const { scorePlan } = await import("@/lib/quality/scorer");
      await scorePlan(opts.planId);
    } catch (e) {
      console.warn("[PlanGen] 전체 품질 점수 계산 실패:", e);
    }

    // 공고 ↔ 사업계획서 매칭 점수 계산
    if (opts.programId) {
      try {
        const { calculateProgramMatchScore } = await import("@/lib/quality/program-match-scorer");
        const matchResult = await calculateProgramMatchScore(opts.planId, opts.programId);
        console.log(`[PlanGen] 매칭 점수: ${matchResult.overall_score}점 (${matchResult.grade}등급)`);
      } catch (e) {
        console.warn("[PlanGen] 공고 매칭 점수 계산 실패:", e);
      }
    }

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
          "#{회원이름}": company.name || "고객",
          "#{계획서명}": plan?.title || "사업계획서",
          "#{품질점수}": "완성",
          "#{링크}": `https://bizplanai.co.kr/plans/${opts.planId}`,
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
