/**
 * 양식 파싱 + 스킬화 모듈
 *
 * 다운로드된 HWPX 양식을 분석하여 "스킬(parsed.json)"로 변환.
 * 스킬 정보는 사업계획서 내보내기 시 필드 매핑에 활용됨.
 *
 * 흐름:
 *   1. 프로그램 디렉토리에서 HWPX 파일 찾기
 *   2. form-parser.ts 로 구조 파싱 (규칙 기반 + AI 보조)
 *   3. 필드별 스킬 정보 생성 (라벨, 타입, 예상 길이, 섹션)
 *   4. parsed.json 저장 (로컬)
 *   5. form_templates DB에 parsed_structure 업데이트
 */

import { existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseFormQuick } from "@/lib/hwpx/form-parser";
import type { FormField, FormSection } from "@/lib/hwpx/types";
import {
  convertHwpToText,
  parseHwpText,
  isHwpConverterAvailable,
} from "@/lib/hwpx/hwp-converter";

// ===== 스킬 타입 =====

export interface FormSkillField {
  id: string;
  label: string;
  type: "text" | "textarea" | "table_cell";
  section: string;
  subsection: string;
  /** AI가 채울 때 참조할 가이드 */
  expectedContent: string;
  /** 예상 최대 글자수 */
  maxLength: number;
  /** 테이블 셀 여부 */
  isInTable: boolean;
}

export interface FormSkill {
  programId: string;
  source: string;
  sourceId: string;
  formTitle: string;
  sections: FormSection[];
  fields: FormSkillField[];
  /** 양식 복잡도 */
  complexity: "simple" | "medium" | "complex";
  /** 전체 필드 수 */
  totalFields: number;
  skillVersion: number;
  createdAt: string;
}

// ===== 유틸리티 =====

/** 필드 타입에 따른 예상 최대 길이 추정 */
function estimateMaxLength(field: FormField): number {
  switch (field.type) {
    case "text":
      return 100; // 단일 라인 텍스트
    case "table_cell":
      return 200; // 테이블 셀
    case "textarea":
      return 2000; // 서술형 (여러 줄)
    default:
      return 500;
  }
}

/** 필드 타입에 따른 작성 가이드 생성 */
function generateExpectedContent(field: FormField): string {
  const { label, type, context } = field;

  // 라벨 기반 가이드
  const labelLower = label.toLowerCase();

  if (labelLower.includes("사업명") || labelLower.includes("프로젝트명")) {
    return "프로젝트/사업 명칭을 간결하게 작성";
  }
  if (labelLower.includes("대표") && labelLower.includes("명")) {
    return "대표자 성명";
  }
  if (labelLower.includes("회사명") || labelLower.includes("기업명")) {
    return "회사/기업 정식 명칭";
  }
  if (labelLower.includes("전화") || labelLower.includes("연락처")) {
    return "전화번호 (000-0000-0000 형식)";
  }
  if (labelLower.includes("이메일") || labelLower.includes("email")) {
    return "이메일 주소";
  }
  if (labelLower.includes("주소")) {
    return "회사 소재지 주소";
  }
  if (labelLower.includes("설립일") || labelLower.includes("창업일")) {
    return "설립/창업 일자 (YYYY.MM.DD)";
  }
  if (labelLower.includes("사업자등록번호")) {
    return "사업자등록번호 (000-00-00000 형식)";
  }
  if (labelLower.includes("매출") || labelLower.includes("매출액")) {
    return "매출액 (단위: 백만원)";
  }

  // 서술형 필드
  if (type === "textarea") {
    if (context.sectionTitle.includes("배경") || label.includes("배경")) {
      return "사업 추진 배경 및 필요성을 500자 이내로 서술";
    }
    if (context.sectionTitle.includes("목표") || label.includes("목표")) {
      return "사업 목표 및 기대효과를 구체적으로 서술";
    }
    if (context.sectionTitle.includes("내용") || label.includes("내용")) {
      return "사업 추진 내용 및 방법을 단계별로 서술";
    }
    if (label.includes("시장") || label.includes("시장분석")) {
      return "목표 시장 규모, 성장률, 경쟁현황 분석";
    }
    if (label.includes("기술") || label.includes("기술개발")) {
      return "핵심 기술 및 개발 현황, 차별성 서술";
    }
    return "관련 내용을 구체적으로 서술";
  }

  return "";
}

// ===== 메인 함수 =====

/**
 * 프로그램 디렉토리에서 HWPX를 파싱하여 스킬화
 * @param programDir 프로그램 디렉토리 경로 (예: data/programs/bizinfo/12345)
 * @param programId DB 프로그램 ID
 * @param source 출처 (bizinfo, mss, kstartup)
 * @param sourceId 출처별 고유 ID
 * @returns 생성된 FormSkill 또는 null (HWPX 없을 때)
 */
export async function buildFormSkill(
  programDir: string,
  programId: string,
  source: string,
  sourceId: string
): Promise<FormSkill | null> {
  // 1. HWPX 파일 찾기
  if (!existsSync(programDir)) {
    console.warn(`[form-skill-builder] 디렉토리 없음: ${programDir}`);
    return null;
  }

  const files = readdirSync(programDir);
  const hwpxFiles = files.filter(
    (f) => f.toLowerCase().endsWith(".hwpx")
  );
  const hwpFiles = files.filter(
    (f) => f.toLowerCase().endsWith(".hwp") && !f.toLowerCase().endsWith(".hwpx")
  );

  // 2. 파싱 시도 (HWPX 우선 → HWP 텍스트 추출 폴백)
  let parsed;

  if (hwpxFiles.length > 0) {
    // HWPX 파일이 있으면 기존 form-parser 사용
    const hwpxPath = join(programDir, hwpxFiles[0]);
    const hwpxBuffer = readFileSync(hwpxPath);
    try {
      parsed = await parseFormQuick(hwpxBuffer);
    } catch (error) {
      console.error(`[form-skill-builder] HWPX 파싱 실패: ${hwpxPath}`, error);
      return null;
    }
  } else if (hwpFiles.length > 0 && isHwpConverterAvailable()) {
    // HWP 바이너리 → LibreOffice 텍스트 추출 → 간이 파싱
    const hwpPath = join(programDir, hwpFiles[0]);
    try {
      const text = await convertHwpToText(hwpPath);
      if (!text) {
        console.warn(`[form-skill-builder] HWP 텍스트 추출 결과 없음: ${hwpPath}`);
        return null;
      }
      const hwpParsed = parseHwpText(text);
      // HWP 텍스트 파싱 결과를 ParsedForm 호환 형태로 변환
      parsed = convertHwpTextToParsedForm(hwpParsed, hwpPath);
    } catch (error) {
      console.error(`[form-skill-builder] HWP 파싱 실패: ${hwpPath}`, error);
      return null;
    }
  } else {
    if (hwpFiles.length > 0) {
      console.warn(`[form-skill-builder] HWP 파일 있으나 LibreOffice 없음: ${programDir}`);
    } else {
      console.warn(`[form-skill-builder] 양식 파일 없음: ${programDir}`);
    }
    return null;
  }

  // 3. 필드별 스킬 정보 생성
  const skillFields: FormSkillField[] = parsed.fields.map((f) => ({
    id: f.id,
    label: f.label,
    type: f.type,
    section: f.context.sectionTitle,
    subsection: f.context.subsectionTitle,
    expectedContent: generateExpectedContent(f),
    maxLength: estimateMaxLength(f),
    isInTable: f.isInTable,
  }));

  const skill: FormSkill = {
    programId,
    source,
    sourceId,
    formTitle: parsed.metadata.title,
    sections: parsed.structure,
    fields: skillFields,
    complexity: parsed.metadata.complexity,
    totalFields: parsed.metadata.totalFields,
    skillVersion: 1,
    createdAt: new Date().toISOString(),
  };

  // 4. parsed.json 저장 (로컬)
  const parsedJsonPath = join(programDir, "parsed.json");
  writeFileSync(parsedJsonPath, JSON.stringify(skill, null, 2), "utf-8");

  // 5. DB 업데이트 (form_templates 테이블)
  try {
    const supabase = createAdminClient();

    // form_templates에서 해당 프로그램의 레코드 찾기
    const { data: existingTemplate } = await supabase
      .from("form_templates")
      .select("id")
      .eq("program_id", programId)
      .limit(1)
      .maybeSingle();

    if (existingTemplate) {
      // 기존 레코드 업데이트
      await supabase
        .from("form_templates")
        .update({
          parsed_structure: skill as any,
          form_title: skill.formTitle,
          status: "parsed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTemplate.id);
    }
    // form_templates 레코드가 없으면 스킵 (collector에서 생성)
  } catch (dbError) {
    console.warn(
      "[form-skill-builder] DB 업데이트 실패 (무시):",
      dbError
    );
  }

  return skill;
}

/**
 * 이미 parsed.json이 있는지 확인 (중복 방지)
 */
export function hasExistingSkill(programDir: string): boolean {
  return existsSync(join(programDir, "parsed.json"));
}

/**
 * 기존 parsed.json 로드
 */
export function loadExistingSkill(
  programDir: string
): FormSkill | null {
  const parsedPath = join(programDir, "parsed.json");
  if (!existsSync(parsedPath)) return null;

  try {
    const content = readFileSync(parsedPath, "utf-8");
    return JSON.parse(content) as FormSkill;
  } catch {
    return null;
  }
}

// ===== HWP 텍스트 → ParsedForm 변환 =====

/**
 * parseHwpText() 결과를 form-parser의 ParsedForm 호환 구조로 변환
 * HWP 바이너리에서 텍스트만 추출된 경우 사용
 */
function convertHwpTextToParsedForm(
  hwpParsed: {
    title: string;
    sections: Array<{ title: string; content: string }>;
    fields: Array<{ label: string; isEmpty: boolean }>;
  },
  filePath: string
): {
  metadata: { title: string; totalFields: number; complexity: "simple" | "medium" | "complex" };
  structure: FormSection[];
  fields: FormField[];
  rawXmlMap?: Map<string, string>;
} {
  const sections: FormSection[] = hwpParsed.sections.map((s, i) => ({
    title: s.title,
    level: 1,
    subsections: [],
  }));

  const fields: FormField[] = hwpParsed.fields.map((f, i) => ({
    id: `hwp_field_${i}`,
    label: f.label,
    type: "textarea" as const,
    xpath: `p[${i}]`,
    sectionFile: "section0.xml",
    isEmpty: f.isEmpty,
    isInTable: false,
    context: {
      sectionTitle: sections[0]?.title || hwpParsed.title,
      subsectionTitle: "",
      precedingText: "",
    },
  }));

  const totalFields = fields.length;
  const complexity = totalFields <= 5 ? "simple" : totalFields <= 15 ? "medium" : "complex";

  return {
    metadata: { title: hwpParsed.title, totalFields, complexity },
    structure: sections,
    fields,
  };
}
