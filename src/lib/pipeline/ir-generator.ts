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
      data: { step: "슬라이드 구조 설계", progress: 20 },
    };

    // 3. Claude로 슬라이드 콘텐츠 생성
    const planSections = (sections ?? [])
      .filter((s: any) => s.content)
      .map((s: any) => ({
        section_name: s.section_name,
        content: s.content,
      }));

    const irResult = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: IR_GENERATOR_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildIRGeneratorPrompt(
            company.name,
            company.business_content,
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

    // 4. JSON 파싱
    let slides: any[] = [];
    try {
      const jsonMatch = irResult.match(/\{[\s\S]*"slides"[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        slides = parsed.slides || [];
      }
    } catch {
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

    // 6. 완성
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
      },
    };
  } catch (error) {
    yield {
      type: "error",
      data: { message: String(error) },
    };
  }
}
