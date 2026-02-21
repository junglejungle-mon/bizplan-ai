/**
 * IR PPT 자동 생성 파이프라인
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import {
  IR_GENERATOR_SYSTEM,
  buildIRGeneratorPrompt,
  IR_SLIDE_TYPES,
  SlideType,
} from "@/lib/ai/prompts/ir";
import { buildDynamicIRContext } from "@/lib/quality/pattern-loader";
import { scoreAndSavePpt } from "@/lib/quality/ppt-scorer";

interface IRGenerateOptions {
  planId: string;
  companyId: string;
  template?: "minimal" | "tech" | "classic" | "professional" | "vibrant" | "custom_ci";
}

// ===== 슬라이드 타입 → 사업계획서 섹션 매핑 =====
const SLIDE_SECTION_MAP: Partial<Record<SlideType, string[]>> = {
  problem: ["시장 분석", "사업 개요", "시장분석", "사업개요"],
  solution: ["사업 개요", "기술 개발 내용", "사업개요", "기술개발"],
  market: ["시장 분석", "시장분석"],
  business_model: ["사업화 전략", "사업화전략"],
  traction: ["기업 현황", "기업현황"],
  competition: ["시장 분석", "시장분석"],
  tech: ["기술 개발 내용", "기술개발", "기술 개발"],
  team: ["기업 현황", "기업현황"],
  financials: ["소요 예산", "기대 효과", "소요예산", "기대효과"],
  ask: ["소요 예산", "소요예산"],
  roadmap: ["추진 일정", "추진일정"],
};

// ===== 슬라이드 타입별 차트 우선순위 =====
const CHART_PRIORITY: Partial<Record<SlideType, string[]>> = {
  market: ["tam_sam_som", "bar", "pie"],
  business_model: ["revenue_model", "bar"],
  traction: ["highlight_cards", "bar", "line"],
  competition: ["comparison_table"],
  tech: ["step_roadmap", "highlight_cards"],
  team: ["org_chart"],
  financials: ["bar", "line", "pie"],
  ask: ["pie", "highlight_cards"],
  roadmap: ["timeline", "step_roadmap"],
  problem: ["pain_points", "highlight_cards"],
  solution: ["comparison_table", "highlight_cards"],
};

/**
 * 차트 데이터를 슬라이드에 매핑 (post-AI enrichment)
 */
 
/* eslint-disable @typescript-eslint/no-explicit-any -- dynamic AI-generated slide/chart JSONB structures */
function mapChartsToSlides(
  slides: Array<Record<string, any>>,
  chartData: Array<Record<string, any>>,
  kpiData: Record<string, any> | null
): Array<Record<string, any>> {
/* eslint-enable @typescript-eslint/no-explicit-any */
  if (!chartData || chartData.length === 0) {
    return slides;
  }

  const enriched = slides.map((slide) => {
    const slideType = slide.slide_type as SlideType;
    const matchingSections = SLIDE_SECTION_MAP[slideType];
    if (!matchingSections) return slide; // cover 등 매핑 없는 타입

    // 매칭 섹션에서 차트 찾기 (부분 매칭 지원)
    const availableCharts = chartData.filter((c) => {
      const sectionName = c.section_name || "";
      return matchingSections.some(
        (ms) =>
          sectionName.includes(ms) ||
          ms.includes(sectionName) ||
          sectionName.replace(/\s/g, "").includes(ms.replace(/\s/g, ""))
      );
    });

    if (availableCharts.length === 0) return slide;

    // 우선순위에 따라 최적 차트 선택
    const priorities = CHART_PRIORITY[slideType] || [];
    let selectedChart = null;
    for (const chartType of priorities) {
      selectedChart = availableCharts.find(
        (c) => c.chart_type === chartType || c.type === chartType
      );
      if (selectedChart) break;
    }

    // 우선순위에 없으면 첫 번째 차트 사용
    if (!selectedChart) {
      selectedChart = availableCharts[0];
    }

    // KPI stats 인리치먼트
    const stats = enrichStatsForSlide(slideType, kpiData);

    return {
      ...slide,
      content: {
        ...slide.content,
        chart: {
          type: selectedChart.chart_type || selectedChart.type,
          title: selectedChart.title,
          data: selectedChart.data,
        },
        ...(stats.length > 0 ? { stats } : {}),
      },
    };
  });

  return enriched;
}

/**
 * KPI 데이터에서 슬라이드별 stats 카드 생성
 */
 
function enrichStatsForSlide(
  slideType: SlideType,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic KPI JSONB from DB
  kpiData: Record<string, any> | null
): Array<{ icon?: string; value: string; label: string }> {
  if (!kpiData) return [];
  const kpis = kpiData.kpis || kpiData;
  const stats: Array<{ icon?: string; value: string; label: string }> = [];

  try {
    switch (slideType) {
      case "traction": {
        // 매출 데이터
        if (kpis.revenue && Array.isArray(kpis.revenue) && kpis.revenue.length > 0) {
          const latest = kpis.revenue[kpis.revenue.length - 1];
          if (latest) {
            const val = latest.value ?? latest.amount ?? latest;
            const unit = latest.unit || "원";
            stats.push({ value: `${val}${unit}`, label: "매출" });
          }
        }
        if (kpis.growth_rate) {
          stats.push({ value: String(kpis.growth_rate), label: "성장률" });
        }
        if (kpis.employees) {
          stats.push({ value: `${kpis.employees}명`, label: "직원 수" });
        }
        if (kpis.customers) {
          stats.push({ value: String(kpis.customers), label: "고객 수" });
        }
        break;
      }
      case "market": {
        if (kpis.tam) {
          const tam =
            typeof kpis.tam === "object"
              ? `${kpis.tam.value}${kpis.tam.unit || ""}`
              : String(kpis.tam);
          stats.push({ value: tam, label: "TAM" });
        }
        if (kpis.sam) {
          const sam =
            typeof kpis.sam === "object"
              ? `${kpis.sam.value}${kpis.sam.unit || ""}`
              : String(kpis.sam);
          stats.push({ value: sam, label: "SAM" });
        }
        if (kpis.som) {
          const som =
            typeof kpis.som === "object"
              ? `${kpis.som.value}${kpis.som.unit || ""}`
              : String(kpis.som);
          stats.push({ value: som, label: "SOM" });
        }
        break;
      }
      case "tech": {
        if (kpis.patents) {
          stats.push({ value: `${kpis.patents}건`, label: "특허" });
        }
        if (kpis.tech_level) {
          stats.push({ value: String(kpis.tech_level), label: "기술 수준" });
        }
        break;
      }
      case "financials": {
        if (kpis.target_revenue) {
          stats.push({
            value: String(kpis.target_revenue),
            label: "목표 매출",
          });
        }
        if (kpis.break_even) {
          stats.push({ value: String(kpis.break_even), label: "손익분기" });
        }
        break;
      }
      case "ask": {
        if (kpis.funding_amount) {
          stats.push({
            value: String(kpis.funding_amount),
            label: "투자 요청",
          });
        }
        break;
      }
    }
  } catch {
    // KPI 파싱 실패는 무시 (stats 없이 진행)
  }

  return stats;
}

export async function* generateIRPresentation(
  opts: IRGenerateOptions
): AsyncGenerator<{
  type: "progress" | "slide_done" | "complete" | "error";
  data: Record<string, unknown>;
}> {
  const supabase = createAdminClient();

  try {
    // 1. 회사 + 사업계획서 정보 로드
    const { data: company } = await supabase
      .from("companies")
      .select("*")
      .eq("id", opts.companyId)
      .single();

    if (!company) throw new Error("회사를 찾을 수 없습니다");

    const { data: plan } = await supabase
      .from("business_plans")
      .select("*")
      .eq("id", opts.planId)
      .single();

    if (!plan) throw new Error("사업계획서를 찾을 수 없습니다");

    // 차트/KPI 데이터 추출 (evaluation_criteria에 저장됨)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const evalCriteria: Record<string, any> = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria || {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartData: Array<Record<string, any>> = evalCriteria.chart_data || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kpiData: Record<string, any> | null = evalCriteria.kpi_data || null;


    const { data: sections } = await supabase
      .from("plan_sections")
      .select("section_name, content")
      .eq("plan_id", opts.planId)
      .order("section_order");

    yield {
      type: "progress",
      data: { step: "사업계획서 분석", progress: 10 },
    };

    // 2. IR 프레젠테이션 레코드 생성
    const { data: presentation, error: presError } = await supabase
      .from("ir_presentations")
      .insert({
        plan_id: opts.planId,
        company_id: opts.companyId,
        title: `${company.name} IR Pitch Deck`,
        template: opts.template || "minimal",
        status: "generating",
      })
      .select()
      .single();

    if (presError || !presentation) {
      throw new Error("IR 프레젠테이션 생성 실패");
    }

    yield {
      type: "progress",
      data: { step: "슬라이드 구조 설계", progress: 15 },
    };

    // 2.5. DB에서 PPT 패턴/평가기준 동적 로드
    let dynamicIRContext = "";
    try {
      dynamicIRContext = await buildDynamicIRContext();
    } catch (e) {
      console.warn("[IR Gen] DB 패턴 로드 실패 (하드코딩 폴백 사용):", e);
    }

    yield {
      type: "progress",
      data: { step: "선정 패턴 분석", progress: 20 },
    };

    // 3. Claude로 슬라이드 콘텐츠 생성
    // 입력 크기를 줄여서 응답 속도 향상 (각 섹션 최대 800자)
    const planSections = (sections ?? [])
      .filter((s: { section_name: string; content: string | null }) => s.content)
      .map((s: { section_name: string; content: string | null }) => ({
        section_name: s.section_name,
        content: (s.content || "").substring(0, 800),
      }));

    // DB 패턴이 있으면 시스템 프롬프트에 주입
    const irSystem = dynamicIRContext
      ? `${IR_GENERATOR_SYSTEM}\n\n${dynamicIRContext}`
      : IR_GENERATOR_SYSTEM;

    const irResult = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: irSystem,
      messages: [
        {
          role: "user",
          content: buildIRGeneratorPrompt(
            company.name,
            company.business_content.substring(0, 1500),
            planSections
          ),
        },
      ],
      temperature: 0.5,
      maxTokens: 8000, // chart/stats 포함 시 JSON이 커짐
    });

    yield {
      type: "progress",
      data: { step: "슬라이드 콘텐츠 생성", progress: 60 },
    };

    // 4. JSON 파싱 (Claude 응답에서 JSON 추출)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let slides: Array<Record<string, any>> = [];
    try {
      let jsonStr = "";

      // 방법 1: ```json ... ``` 코드 블록에서 추출
      const codeBlockMatch = irResult.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (codeBlockMatch) {
        jsonStr = codeBlockMatch[1].trim();
      } else {
        // 방법 2: 첫번째 { 부터 마지막 } 까지
        const firstBrace = irResult.indexOf("{");
        const lastBrace = irResult.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonStr = irResult.substring(firstBrace, lastBrace + 1);
        }
      }

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        slides = parsed.slides || [];
      }

      if (slides.length === 0) {
        throw new Error("슬라이드 데이터가 비어있습니다");
      }
    } catch (parseError) {
      console.error("[IR Generator] JSON 파싱 실패:", parseError);
      console.error(
        "[IR Generator] Claude 원본 응답 (처음 500자):",
        irResult.substring(0, 500)
      );
      // 파싱 실패 시 기본 슬라이드 생성
      slides = IR_SLIDE_TYPES.map((type, i) => ({
        slide_type: type,
        title: `슬라이드 ${i + 1}`,
        content: {
          headline: "콘텐츠 생성 중 오류가 발생했습니다",
          bullets: ["수동으로 내용을 입력해주세요"],
        },
        notes: "",
      }));
    }

    // 4.5. 차트 데이터 인리치먼트 (슬라이드에 chart/stats 추가)
    slides = mapChartsToSlides(slides, chartData, kpiData);

    yield {
      type: "progress",
      data: { step: "차트 데이터 매핑", progress: 65 },
    };

    // 5. ir_slides 테이블에 저장 (에러 처리 강화)
    let insertedCount = 0;
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      try {
        // content JSON 직렬화 검증
        const safeContent = JSON.parse(JSON.stringify(slide.content || {}));

        const { error: insertError } = await supabase.from("ir_slides").insert({
          presentation_id: presentation.id,
          slide_order: i + 1,
          slide_type: slide.slide_type,
          title: slide.title || `슬라이드 ${i + 1}`,
          content: safeContent,
          notes: slide.notes || "",
        });

        if (insertError) {
          console.error(`[IR Gen] 슬라이드 ${i + 1} 저장 실패:`, insertError.message);
          // 실패해도 나머지 슬라이드 저장 계속 진행
        } else {
          insertedCount++;
        }
      } catch (slideErr) {
        console.error(`[IR Gen] 슬라이드 ${i + 1} 처리 오류:`, slideErr);
      }

      yield {
        type: "slide_done",
        data: {
          slideOrder: i + 1,
          slideType: slide.slide_type,
          title: slide.title,
          progress: Math.round(60 + ((i + 1) / slides.length) * 35),
        },
      };
    }

    if (insertedCount === 0) {
      console.error("[IR Gen] 모든 슬라이드 저장 실패!");
      yield {
        type: "error",
        data: { message: "슬라이드 저장에 실패했습니다. 다시 시도해주세요." },
      };
      return;
    }

    // 6. 자동 품질 채점
    let pptScore = 0;
    try {
      const scoreResult = await scoreAndSavePpt(presentation.id, slides as Array<{ slide_type: string; title: string; content: Record<string, unknown>; notes?: string }>);
      pptScore = scoreResult.total_score;
    } catch (e) {
      console.warn("[IR Gen] PPT 자동 채점 실패:", e);
    }

    // 7. 완성
    await supabase
      .from("ir_presentations")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", presentation.id);

    yield {
      type: "complete",
      data: {
        presentationId: presentation.id,
        totalSlides: slides.length,
        progress: 100,
        qualityScore: pptScore,
      },
    };
  } catch (error) {
    yield {
      type: "error",
      data: { message: String(error) },
    };
  }
}
