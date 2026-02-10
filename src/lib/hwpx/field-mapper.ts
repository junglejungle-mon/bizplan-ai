/**
 * AI 기반 사업계획서 ↔ 양식 필드 매핑
 *
 * 입력:
 *   - ParsedForm.fields (양식 필드 목록)
 *   - plan_sections[] (사업계획서 섹션별 content)
 * 출력:
 *   - FieldMapping[] (어떤 필드에 어떤 섹션 내용을 넣을지)
 */

import { callClaude } from "@/lib/ai/claude";
import type { FormField, FieldMapping } from "./types";

interface PlanSection {
  section_order: number;
  section_name: string;
  content: string | null;
}

/**
 * AI가 양식 필드와 사업계획서 섹션을 매핑
 */
export async function mapFieldsToPlan(
  formFields: FormField[],
  planSections: PlanSection[]
): Promise<FieldMapping[]> {
  if (formFields.length === 0 || planSections.length === 0) {
    return [];
  }

  // 먼저 규칙 기반 매핑 시도
  const ruleMappings = ruleBasedMapping(formFields, planSections);

  // 매핑되지 않은 필드만 AI에게 위임
  const mappedIds = new Set(ruleMappings.map((m) => m.formFieldId));
  const unmappedFields = formFields.filter((f) => !mappedIds.has(f.id));

  if (unmappedFields.length === 0) {
    return ruleMappings;
  }

  // AI 매핑
  const aiMappings = await aiMapping(unmappedFields, planSections);

  return [...ruleMappings, ...aiMappings];
}

// ===== 규칙 기반 매핑 =====

/** 키워드 매칭으로 빠르게 매핑 가능한 필드 처리 */
function ruleBasedMapping(
  fields: FormField[],
  sections: PlanSection[]
): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  // 라벨 → 섹션 키워드 매핑 규칙
  const KEYWORD_MAP: Record<string, string[]> = {
    // 아이템/제품 관련
    아이템: ["아이템", "개요", "제품", "서비스"],
    사업명: ["아이템", "개요"],
    제품명: ["아이템", "제품"],
    서비스명: ["아이템", "서비스"],
    아이템소개: ["아이템", "개요", "소개"],
    개발동기: ["아이템", "동기", "배경"],
    // 시장 관련
    목표시장: ["시장", "분석", "타겟"],
    시장분석: ["시장", "분석"],
    경쟁현황: ["시장", "경쟁", "분석"],
    경쟁분석: ["경쟁", "분석"],
    // 사업화 관련
    수익모델: ["사업화", "수익", "모델", "전략"],
    출시로드맵: ["사업화", "로드맵", "일정", "전략"],
    사업화전략: ["사업화", "전략"],
    마케팅전략: ["마케팅", "전략"],
    // 자금 관련
    자금소요: ["자금", "예산", "재무"],
    자금조달: ["자금", "조달", "재무"],
    // 팀 관련
    대표자이력: ["팀", "대표", "이력"],
    대표자: ["팀", "대표"],
    팀원현황: ["팀", "구성", "인력"],
    팀구성: ["팀", "구성"],
    // 기술 관련
    기술현황: ["기술", "개발", "특허"],
    특허현황: ["기술", "특허", "지식재산"],
    // 추진배경
    추진배경: ["배경", "필요성", "개요"],
    필요성: ["배경", "필요성"],
  };

  for (const field of fields) {
    // 라벨에서 공백/특수문자 제거하여 키워드 매칭
    const normalizedLabel = field.label
      .replace(/[\s\-_.:：()（）]/g, "")
      .trim();

    for (const [keyword, sectionKeywords] of Object.entries(KEYWORD_MAP)) {
      if (
        normalizedLabel.includes(keyword) ||
        keyword.includes(normalizedLabel)
      ) {
        // 가장 적합한 섹션 찾기
        const bestSection = findBestSection(sections, sectionKeywords);
        if (bestSection) {
          mappings.push({
            formFieldId: field.id,
            formFieldLabel: field.label,
            planSectionOrder: bestSection.section_order,
            planSectionName: bestSection.section_name,
            strategy: field.type === "textarea" ? "direct" : "extract",
            confidence: 80,
            extractPrompt:
              field.type !== "textarea"
                ? `다음 내용에서 "${field.label}"에 해당하는 내용만 간결하게 추출해주세요.`
                : undefined,
          });
          break;
        }
      }
    }
  }

  return mappings;
}

/** 키워드로 가장 적합한 섹션 찾기 */
function findBestSection(
  sections: PlanSection[],
  keywords: string[]
): PlanSection | null {
  let bestScore = 0;
  let bestSection: PlanSection | null = null;

  for (const section of sections) {
    if (!section.content) continue;

    const name = section.section_name.toLowerCase();
    let score = 0;

    for (const kw of keywords) {
      if (name.includes(kw)) score += 2;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSection = section;
    }
  }

  return bestSection;
}

// ===== AI 기반 매핑 =====

async function aiMapping(
  unmappedFields: FormField[],
  planSections: PlanSection[]
): Promise<FieldMapping[]> {
  const fieldsList = unmappedFields
    .map(
      (f) =>
        `- ID: ${f.id}, 라벨: "${f.label}", 유형: ${f.type}, 컨텍스트: "${f.context.sectionTitle} > ${f.context.subsectionTitle}"`
    )
    .join("\n");

  const sectionsList = planSections
    .map((s) => {
      const preview = s.content
        ? s.content.substring(0, 200).replace(/\n/g, " ")
        : "(미작성)";
      return `- 섹션 ${s.section_order}: "${s.section_name}" → ${preview}...`;
    })
    .join("\n");

  const prompt = `양식 필드와 사업계획서 섹션을 매핑해주세요.

## 양식 필드 (작성해야 할 칸):
${fieldsList}

## 사업계획서 섹션 (참고할 내용):
${sectionsList}

각 양식 필드에 대해, 어떤 사업계획서 섹션의 내용을 사용해야 하는지 매핑하세요.

JSON 배열로 반환 (필드마다 하나):
[{
  "formFieldId": "field_id",
  "formFieldLabel": "필드명",
  "planSectionOrder": 섹션번호,
  "planSectionName": "섹션명",
  "strategy": "direct|extract|summarize|skip",
  "confidence": 0-100,
  "extractPrompt": "추출 지시문 (strategy가 extract/summarize일 때)"
}]

strategy 설명:
- direct: 해당 섹션 전체 내용을 그대로 사용
- extract: 해당 섹션에서 특정 부분만 추출
- summarize: 해당 섹션 내용을 요약
- skip: 매핑할 적절한 섹션이 없음

JSON 배열만 반환하세요.`;

  try {
    const response = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: "당신은 정부지원사업 사업계획서 전문가입니다. JSON만 반환하세요.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 4096,
      temperature: 0.1,
    });

    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return fallbackMapping(unmappedFields, planSections);

    const parsed = JSON.parse(jsonMatch[0]) as FieldMapping[];

    // 유효성 검증
    return parsed.filter(
      (m) =>
        m.formFieldId &&
        m.planSectionOrder >= 0 &&
        ["direct", "extract", "summarize", "skip"].includes(m.strategy)
    );
  } catch (error) {
    console.warn("[field-mapper] AI 매핑 실패, 폴백 매핑 사용:", error);
    return fallbackMapping(unmappedFields, planSections);
  }
}

/** AI 실패 시 단순 순서 기반 폴백 매핑 */
function fallbackMapping(
  fields: FormField[],
  sections: PlanSection[]
): FieldMapping[] {
  return fields.map((field, i) => {
    const sectionIdx = Math.min(i, sections.length - 1);
    const section = sections[sectionIdx];
    return {
      formFieldId: field.id,
      formFieldLabel: field.label,
      planSectionOrder: section?.section_order ?? 1,
      planSectionName: section?.section_name ?? "",
      strategy: "summarize" as const,
      confidence: 30,
      extractPrompt: `"${field.label}"에 해당하는 내용을 작성해주세요.`,
    };
  });
}

/**
 * 매핑에 따라 각 필드의 실제 삽입 텍스트를 생성
 * strategy에 따라 직접 사용, AI 추출, AI 요약
 */
export async function generateFieldContents(
  mappings: FieldMapping[],
  planSections: PlanSection[]
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  const sectionMap = new Map(
    planSections.map((s) => [s.section_order, s])
  );

  // direct 매핑은 즉시 처리
  const aiTasks: Array<{
    fieldId: string;
    mapping: FieldMapping;
    sectionContent: string;
  }> = [];

  for (const mapping of mappings) {
    if (mapping.strategy === "skip") continue;

    const section = sectionMap.get(mapping.planSectionOrder);
    if (!section?.content) continue;

    if (mapping.strategy === "direct") {
      contents[mapping.formFieldId] = section.content;
    } else {
      aiTasks.push({
        fieldId: mapping.formFieldId,
        mapping,
        sectionContent: section.content,
      });
    }
  }

  // extract/summarize는 AI 배치 처리
  if (aiTasks.length > 0) {
    const batchPrompt = aiTasks
      .map(
        (task, i) =>
          `[${i}] 필드: "${task.mapping.formFieldLabel}"
전략: ${task.mapping.strategy}
지시: ${task.mapping.extractPrompt || "적절한 내용을 작성"}
원본 내용:
${task.sectionContent.substring(0, 1000)}`
      )
      .join("\n\n---\n\n");

    try {
      const response = await callClaude({
        model: "claude-haiku-4-5-20251001",
        system: `정부지원사업 사업계획서 양식을 채우는 전문가입니다.
각 필드에 맞는 내용을 원본에서 추출하거나 요약하여 작성합니다.
JSON 객체로 반환: {"0": "내용", "1": "내용", ...}`,
        messages: [{ role: "user", content: batchPrompt }],
        maxTokens: 8192,
        temperature: 0.3,
      });

      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const results = JSON.parse(jsonMatch[0]) as Record<string, string>;
        for (const [idx, text] of Object.entries(results)) {
          const task = aiTasks[parseInt(idx)];
          if (task) {
            contents[task.fieldId] = text;
          }
        }
      }
    } catch (error) {
      console.warn("[field-mapper] AI 콘텐츠 생성 실패:", error);
      // 실패 시 원본 내용 그대로 사용
      for (const task of aiTasks) {
        contents[task.fieldId] = task.sectionContent;
      }
    }
  }

  return contents;
}
