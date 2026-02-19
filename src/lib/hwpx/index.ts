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
import { loadExistingSkill } from "@/lib/pipeline/form-skill-builder";
import { existsSync } from "fs";
import { join } from "path";

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
  const strategyLog: string[] = [];
  const warnings: string[] = [];

  // ===== Stage 1: Smart Fill (양식 파싱 → AI 매핑 → 채우기) =====
  if (plan.programId && supabase) {
    try {
      strategyLog.push("[1/3] Smart Fill 시도...");
      const result = await trySmartFill(plan, supabase);

      if (result) {
        // filledCount === 0이면 실질적 실패 → 즉시 fallback
        if (result.filledFields === 0) {
          strategyLog.push(
            `[1/3] Smart Fill 완료했으나 채운 필드 0개 (스킵 ${result.skippedFields}개) → 폴백`
          );
          warnings.push(...result.warnings);
        } else {
          const fillRate = Math.round(
            (result.filledFields / (result.filledFields + result.skippedFields)) * 100
          );
          strategyLog.push(
            `[1/3] Smart Fill 성공: ${result.filledFields}개 채움, ${result.skippedFields}개 스킵 (채움률 ${fillRate}%)`
          );
          result.warnings.push(...strategyLog);
          return result;
        }
      } else {
        strategyLog.push("[1/3] Smart Fill 실패 (양식 없음 또는 파싱 불가)");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "알 수 없는 오류";
      strategyLog.push(`[1/3] Smart Fill 오류: ${errMsg}`);
      warnings.push(`Smart fill 오류: ${errMsg}`);
    }
  } else {
    strategyLog.push("[1/3] Smart Fill 건너뜀 (programId 또는 supabase 없음)");
  }

  // ===== Stage 2: Placeholder Fill ({{placeholder}} 기반) =====
  if (plan.programId && supabase) {
    try {
      strategyLog.push("[2/3] Placeholder Fill 시도...");
      const result = await tryPlaceholderFill(plan, supabase);

      if (result) {
        if (result.filledFields === 0) {
          strategyLog.push(
            "[2/3] Placeholder Fill 완료했으나 매핑된 필드 0개 → 폴백"
          );
        } else {
          strategyLog.push(
            `[2/3] Placeholder Fill 성공: ${result.filledFields}개 채움, ${result.skippedFields}개 스킵`
          );
          result.warnings.push(...warnings, ...strategyLog);
          return result;
        }
      } else {
        strategyLog.push("[2/3] Placeholder Fill 실패 (placeholder 없음)");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : "알 수 없는 오류";
      strategyLog.push(`[2/3] Placeholder Fill 오류: ${errMsg}`);
      warnings.push(`Placeholder fill 오류: ${errMsg}`);
    }
  } else {
    strategyLog.push("[2/3] Placeholder Fill 건너뜀");
  }

  // ===== Stage 3: From Scratch (처음부터 생성) =====
  strategyLog.push("[3/3] From Scratch 생성 시작...");
  const result = await tryFromScratch(plan, [...warnings, ...strategyLog]);
  strategyLog.push(
    `[3/3] From Scratch 완료: ${result.filledFields}개 섹션 포함`
  );
  result.warnings = [...warnings, ...strategyLog];
  return result;
}

// ===== Stage 1: Smart Fill =====

async function trySmartFill(
  plan: BusinessPlanData,
  supabase: SupabaseClient
): Promise<FillResult | null> {
  const t0 = Date.now();

  // 1. 양식 템플릿 조회/다운로드
  let template = await getFormTemplate(supabase, plan.programId!);
  if (!template) {
    template = await downloadAndCacheTemplate(supabase, plan.programId!);
  }

  if (!template || template.status === "failed") {
    console.log(`[hwpx] Smart Fill: 양식 없음 (programId=${plan.programId})`);
    return null;
  }
  console.log(
    `[hwpx] Smart Fill 시작: template=${template.id}, status=${template.status}`
  );

  // 2. HWPX 파일 가져오기
  const hwpxBuffer = await downloadTemplateBuffer(supabase, template);
  if (!hwpxBuffer) {
    console.log("[hwpx] Smart Fill: HWPX 다운로드 실패");
    return null;
  }
  console.log(`[hwpx] HWPX 다운로드 완료: ${(hwpxBuffer.length / 1024).toFixed(1)}KB (${Date.now() - t0}ms)`);

  // 3. 로컬 스킬 정보 확인 (parsed.json)
  const localSkill = await tryLoadLocalSkill(supabase, plan.programId!);
  if (localSkill) {
    console.log(
      `[hwpx] 로컬 스킬 로드 성공: ${localSkill.fields.length}개 필드 힌트`
    );
  }

  // 4. 양식 파싱 (스킬 정보 or DB 캐시 or 새로 파싱)
  const t1 = Date.now();
  let parsedForm: ParsedForm;
  let parseSource: string;

  if (template.parsed_structure) {
    parsedForm = template.parsed_structure;
    // rawXmlMap은 캐시에 없으므로 다시 파싱
    const freshParsed = await parseForm(hwpxBuffer, false);
    parsedForm.rawXmlMap = freshParsed.rawXmlMap;
    parseSource = "DB캐시";
  } else {
    parsedForm = await parseForm(hwpxBuffer, true);
    parseSource = "신규파싱";

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

  console.log(
    `[hwpx] 파싱 완료 (${parseSource}): 필드 ${parsedForm.fields.length}개, 섹션 ${parsedForm.structure.length}개, 복잡도=${parsedForm.metadata.complexity} (${Date.now() - t1}ms)`
  );

  // 필드가 없으면 smart fill 불가
  if (parsedForm.fields.length === 0) {
    console.log("[hwpx] Smart Fill 중단: 필드 0개 탐지됨");
    return null;
  }

  // 5. AI 필드 매핑 (스킬 정보 활용)
  const t2 = Date.now();
  let mappings: FieldMapping[];
  let mappingSource: string;

  if (template.field_mappings && template.field_mappings.length > 0) {
    mappings = template.field_mappings;
    mappingSource = "DB캐시";
  } else {
    mappings = await mapFieldsToPlan(
      parsedForm.fields,
      plan.sections,
      localSkill || undefined
    );
    mappingSource = "신규매핑";

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

  const skipCount = mappings.filter((m) => m.strategy === "skip").length;
  const avgConfidence =
    mappings.length > 0
      ? Math.round(
          mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length
        )
      : 0;
  console.log(
    `[hwpx] 매핑 완료 (${mappingSource}): ${mappings.length}개 매핑, skip=${skipCount}개, 평균신뢰도=${avgConfidence}% (${Date.now() - t2}ms)`
  );

  // 6. 필드별 내용 생성 (스킬의 maxLength 정보 활용)
  const t3 = Date.now();
  const fieldContents = await generateFieldContents(
    mappings,
    plan.sections,
    localSkill || undefined
  );
  console.log(
    `[hwpx] 콘텐츠 생성 완료: ${Object.keys(fieldContents).length}개 필드 (${Date.now() - t3}ms)`
  );

  // 7. 양식에 내용 삽입
  const t4 = Date.now();
  const result = await fillForm(hwpxBuffer, parsedForm, fieldContents);
  console.log(
    `[hwpx] 양식 채우기 완료: filled=${result.filledCount}, skipped=${result.skippedCount} (${Date.now() - t4}ms)`
  );

  // 8. business_plans 업데이트
  await supabase
    .from("business_plans")
    .update({
      form_template_id: template.id,
      fill_strategy: "smart_fill",
    })
    .eq("id", plan.planId);

  console.log(
    `[hwpx] ✅ Smart Fill 전체 완료: ${Date.now() - t0}ms`
  );

  return {
    success: true,
    strategy: "smart_fill",
    filledFields: result.filledCount,
    skippedFields: result.skippedCount,
    buffer: result.buffer,
    warnings: result.warnings,
  };
}

/**
 * 로컬 parsed.json 스킬 정보 로드 시도
 * programs 테이블에서 source, source_id를 조회하여 경로 결정
 */
async function tryLoadLocalSkill(
  supabase: SupabaseClient,
  programId: string
): Promise<import("@/lib/pipeline/form-skill-builder").FormSkill | null> {
  if (process.env.VERCEL) return null;

  try {
    const { data: program } = await supabase
      .from("programs")
      .select("source, source_id")
      .eq("id", programId)
      .single();

    if (!program) return null;

    const programDir = join(
      process.cwd(),
      "data",
      "programs",
      program.source,
      program.source_id
    );

    return loadExistingSkill(programDir);
  } catch {
    return null;
  }
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
