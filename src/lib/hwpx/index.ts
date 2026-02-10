/**
 * HWPX 양식폼 자동채우기 - 통합 진입점
 *
 * 3단계 폴백:
 *   1. [smart_fill]       양식 파싱 → AI 매핑 → 양식 채우기
 *   2. [placeholder_fill] {{placeholder}} 기반 채우기 (기존 template-filler)
 *   3. [from_scratch]     처음부터 HWPX 생성 (기존 hwpx-builder)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusinessPlanData, FillResult, ParsedForm, FieldMapping } from "./types";
import { parseForm } from "./form-parser";
import { mapFieldsToPlan, generateFieldContents } from "./field-mapper";
import { fillForm } from "./form-filler";
import {
  getFormTemplate,
  downloadAndCacheTemplate,
  downloadTemplateBuffer,
} from "./template-manager";
import {
  parseHwpxTemplate,
  fillHwpxTemplate,
} from "./template-filler";
import { buildHwpx } from "@/lib/utils/hwpx-builder";

// ===== 메인 진입점 =====

/**
 * 사업계획서를 HWPX로 내보내기 (양식폼 자동채우기)
 *
 * programId가 있고 양식이 있으면 smart_fill 시도,
 * 실패 시 placeholder_fill → from_scratch 순으로 폴백
 */
export async function exportHwpxWithFormFill(
  plan: BusinessPlanData,
  supabase?: SupabaseClient
): Promise<FillResult> {
  const warnings: string[] = [];

  // ===== Stage 1: Smart Fill (양식 파싱 → AI 매핑 → 채우기) =====
  if (plan.programId && supabase) {
    try {
      const result = await trySmartFill(plan, supabase);
      if (result) return result;
      warnings.push("Smart fill 실패, placeholder fill로 폴백");
    } catch (error) {
      warnings.push(
        `Smart fill 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
    }
  }

  // ===== Stage 2: Placeholder Fill ({{placeholder}} 기반) =====
  if (plan.programId && supabase) {
    try {
      const result = await tryPlaceholderFill(plan, supabase);
      if (result) {
        result.warnings.push(...warnings);
        return result;
      }
      warnings.push("Placeholder fill 실패, from scratch로 폴백");
    } catch (error) {
      warnings.push(
        `Placeholder fill 오류: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
      );
    }
  }

  // ===== Stage 3: From Scratch (처음부터 생성) =====
  return tryFromScratch(plan, warnings);
}

// ===== Stage 1: Smart Fill =====

async function trySmartFill(
  plan: BusinessPlanData,
  supabase: SupabaseClient
): Promise<FillResult | null> {
  // 1. 양식 템플릿 조회/다운로드
  let template = await getFormTemplate(supabase, plan.programId!);
  if (!template) {
    template = await downloadAndCacheTemplate(supabase, plan.programId!);
  }

  if (!template || template.status === "failed") {
    return null;
  }

  // 2. HWPX 파일 가져오기
  const hwpxBuffer = await downloadTemplateBuffer(supabase, template);
  if (!hwpxBuffer) return null;

  // 3. 양식 파싱 (캐시 확인)
  let parsedForm: ParsedForm;
  if (template.parsed_structure) {
    parsedForm = template.parsed_structure;
    // rawXmlMap은 캐시에 없으므로 다시 파싱
    const freshParsed = await parseForm(hwpxBuffer, false);
    parsedForm.rawXmlMap = freshParsed.rawXmlMap;
  } else {
    parsedForm = await parseForm(hwpxBuffer, true);

    // 파싱 결과 DB 캐시
    await supabase
      .from("form_templates")
      .update({
        parsed_structure: {
          ...parsedForm,
          rawXmlMap: undefined, // XML 원본은 DB에 저장하지 않음
        },
        form_title: parsedForm.metadata.title,
        status: "parsed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);
  }

  // 필드가 없으면 smart fill 불가
  if (parsedForm.fields.length === 0) {
    return null;
  }

  // 4. AI 필드 매핑
  let mappings: FieldMapping[];
  if (template.field_mappings && template.field_mappings.length > 0) {
    mappings = template.field_mappings;
  } else {
    mappings = await mapFieldsToPlan(parsedForm.fields, plan.sections);

    // 매핑 결과 DB 캐시
    await supabase
      .from("form_templates")
      .update({
        field_mappings: mappings,
        status: "mapped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", template.id);
  }

  // 5. 필드별 내용 생성
  const fieldContents = await generateFieldContents(mappings, plan.sections);

  // 6. 양식에 내용 삽입
  const result = await fillForm(hwpxBuffer, parsedForm, fieldContents);

  // 7. business_plans 업데이트
  await supabase
    .from("business_plans")
    .update({
      form_template_id: template.id,
      fill_strategy: "smart_fill",
    })
    .eq("id", plan.planId);

  return {
    success: true,
    strategy: "smart_fill",
    filledFields: result.filledCount,
    skippedFields: result.skippedCount,
    buffer: result.buffer,
    warnings: result.warnings,
  };
}

// ===== Stage 2: Placeholder Fill =====

async function tryPlaceholderFill(
  plan: BusinessPlanData,
  supabase: SupabaseClient
): Promise<FillResult | null> {
  // 양식 템플릿 가져오기
  const template = await getFormTemplate(supabase, plan.programId!);
  if (!template) return null;

  const hwpxBuffer = await downloadTemplateBuffer(supabase, template);
  if (!hwpxBuffer) return null;

  // {{placeholder}} 파싱 시도
  const parsed = await parseHwpxTemplate(hwpxBuffer);
  if (parsed.fields.length === 0) {
    return null; // placeholder 없음 → 이 전략 사용 불가
  }

  // 사업계획서 섹션을 FillData 형태로 변환
  const fillData: Record<string, string> = {};
  for (const field of parsed.fields) {
    // 키(placeholder명)와 가장 유사한 섹션 내용 매핑
    const matchedSection = plan.sections.find((s) => {
      const sName = s.section_name.toLowerCase();
      const fKey = field.key.toLowerCase();
      return sName.includes(fKey) || fKey.includes(sName);
    });

    if (matchedSection?.content) {
      fillData[field.key] = matchedSection.content;
    }
  }

  if (Object.keys(fillData).length === 0) {
    return null;
  }

  const filledBuffer = await fillHwpxTemplate(hwpxBuffer, fillData);

  return {
    success: true,
    strategy: "placeholder_fill",
    filledFields: Object.keys(fillData).length,
    skippedFields: parsed.fields.length - Object.keys(fillData).length,
    buffer: filledBuffer,
    warnings: [],
  };
}

// ===== Stage 3: From Scratch =====

async function tryFromScratch(
  plan: BusinessPlanData,
  priorWarnings: string[]
): Promise<FillResult> {
  const buffer = await buildHwpx({
    title: plan.title,
    companyName: plan.companyName,
    sections: plan.sections,
    chartData: plan.chartData as Record<string, any>,
    kpiData: plan.kpiData as Record<string, unknown>,
    templateType: plan.templateType,
  });

  return {
    success: true,
    strategy: "from_scratch",
    filledFields: plan.sections.filter((s) => s.content).length,
    skippedFields: plan.sections.filter((s) => !s.content).length,
    buffer,
    warnings: [
      ...priorWarnings,
      "양식폼을 찾을 수 없어 처음부터 생성했습니다.",
    ],
  };
}

// ===== Re-exports =====
export type {
  BusinessPlanData,
  FillResult,
  ParsedForm,
  FieldMapping,
  FormField,
  FormSection,
  FormTemplate,
} from "./types";
