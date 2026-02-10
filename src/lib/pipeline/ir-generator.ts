/**
 * IR PPT 자동 생성 파이프라인
 */

import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import {
  IR_GENERATOR_SYSTEM,
  buildIRGeneratorPrompt,
  IR_SLIDE_TYPES,
} from "@/lib/ai/prompts/ir";
import { buildDynamicIRContext } from "@/lib/quality/pattern-loader";
import { scoreAndSavePpt } from "@/lib/quality/ppt-scorer";

interface IRGenerateOptions {
  planId: string;
  companyId: string;
  template?: "minimal" | "tech" | "classic";
}

export async function* generateIRPresentation(
  opts: IRGenerateOptions
): AsyncGenerator<{
  type: "progress" | "slide_done" | "complete" | "error";
  data: any;
}> {
  const supabase = await createClient();

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
      .filter((s: any) => s.content)
      .map((s: any) => ({
        section_name: s.section_name,
        content: s.content.substring(0, 800),
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
      maxTokens: 4000,
    });

    yield {
      type: "progress",
      data: { step: "슬라이드 콘텐츠 생성", progress: 60 },
    };

    // 4. JSON 파싱 (Claude 응답에서 JSON 추출)
    let slides: any[] = [];
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

    // 5. ir_slides 테이블에 저장
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i];

      await supabase.from("ir_slides").insert({
        presentation_id: presentation.id,
        slide_order: i + 1,
        slide_type: slide.slide_type,
        title: slide.title,
        content: slide.content,
        notes: slide.notes || "",
      });

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

    // 6. 자동 품질 채점
    let pptScore = 0;
    try {
      const scoreResult = await scoreAndSavePpt(presentation.id, slides);
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
