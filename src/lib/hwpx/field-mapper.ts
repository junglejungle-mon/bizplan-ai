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
import type { FormSkill, FormSkillField } from "@/lib/pipeline/form-skill-builder";

interface PlanSection {
  section_order: number;
  section_name: string;
  content: string | null;
}

/**
 * AI가 양식 필드와 사업계획서 섹션을 매핑
 * @param formSkill - 로컬 스킬 정보 (있으면 매핑 힌트로 활용)
 */
export async function mapFieldsToPlan(
  formFields: FormField[],
  planSections: PlanSection[],
  formSkill?: FormSkill
): Promise<FieldMapping[]> {
  if (formFields.length === 0 || planSections.length === 0) {
    return [];
  }

  // 스킬 정보로 필드 힌트 맵 생성 (field.id → expectedContent, maxLength)
  const skillHints = new Map<string, FormSkillField>();
  if (formSkill) {
    for (const sf of formSkill.fields) {
      skillHints.set(sf.id, sf);
    }
  }

  // 먼저 규칙 기반 매핑 시도 (스킬 힌트 활용)
  const ruleMappings = ruleBasedMapping(formFields, planSections, skillHints);

  // 매핑되지 않은 필드만 AI에게 위임
  const mappedIds = new Set(ruleMappings.map((m) => m.formFieldId));
  const unmappedFields = formFields.filter((f) => !mappedIds.has(f.id));

  console.log(
    `[field-mapper] 규칙 매핑 ${ruleMappings.length}개 / 미매핑 ${unmappedFields.length}개 (전체 ${formFields.length}개)`
  );

  if (unmappedFields.length === 0) {
    return ruleMappings;
  }

  // AI 매핑 (스킬 힌트 전달)
  console.log(
    `[field-mapper] AI 매핑 시작: ${unmappedFields.map((f) => `"${f.label}"`).join(", ")}`
  );
  const aiMappings = await aiMapping(unmappedFields, planSections, skillHints);
  console.log(
    `[field-mapper] AI 매핑 완료: ${aiMappings.length}개 (skip ${aiMappings.filter((m) => m.strategy === "skip").length}개)`
  );

  return [...ruleMappings, ...aiMappings];
}

// ===== 규칙 기반 매핑 =====

/** 키워드 매칭으로 빠르게 매핑 가능한 필드 처리 */
function ruleBasedMapping(
  fields: FormField[],
  sections: PlanSection[],
  skillHints?: Map<string, FormSkillField>
): FieldMapping[] {
  const mappings: FieldMapping[] = [];

  // 라벨 → 섹션 키워드 매핑 규칙 (50개+)
  // matchStrength: "exact" = 완전 매칭(95), "partial" = 부분 매칭(80)
  const KEYWORD_MAP: Record<string, { keywords: string[]; strength: "exact" | "partial" }> = {
    // ===== 아이템/제품 관련 =====
    아이템: { keywords: ["아이템", "개요", "제품", "서비스"], strength: "exact" },
    사업명: { keywords: ["아이템", "개요"], strength: "exact" },
    제품명: { keywords: ["아이템", "제품"], strength: "exact" },
    서비스명: { keywords: ["아이템", "서비스"], strength: "exact" },
    아이템소개: { keywords: ["아이템", "개요", "소개"], strength: "exact" },
    개발동기: { keywords: ["아이템", "동기", "배경"], strength: "exact" },
    사업개요: { keywords: ["개요", "아이템", "소개"], strength: "exact" },
    제품소개: { keywords: ["아이템", "제품", "개요"], strength: "exact" },
    제품사양: { keywords: ["아이템", "제품", "기술"], strength: "partial" },
    핵심기능: { keywords: ["아이템", "제품", "기술"], strength: "partial" },

    // ===== 시장 관련 =====
    목표시장: { keywords: ["시장", "분석", "타겟"], strength: "exact" },
    시장분석: { keywords: ["시장", "분석"], strength: "exact" },
    시장규모: { keywords: ["시장", "분석"], strength: "exact" },
    시장현황: { keywords: ["시장", "분석", "현황"], strength: "exact" },
    경쟁현황: { keywords: ["시장", "경쟁", "분석"], strength: "exact" },
    경쟁분석: { keywords: ["경쟁", "분석"], strength: "exact" },
    경쟁사: { keywords: ["경쟁", "분석", "시장"], strength: "partial" },
    고객분석: { keywords: ["시장", "고객", "타겟"], strength: "partial" },
    타깃고객: { keywords: ["시장", "고객", "타겟"], strength: "partial" },

    // ===== 사업화/전략 관련 =====
    수익모델: { keywords: ["사업화", "수익", "모델", "전략"], strength: "exact" },
    비즈니스모델: { keywords: ["사업화", "수익", "모델"], strength: "exact" },
    출시로드맵: { keywords: ["사업화", "로드맵", "일정", "전략"], strength: "exact" },
    사업화전략: { keywords: ["사업화", "전략"], strength: "exact" },
    마케팅전략: { keywords: ["마케팅", "전략"], strength: "exact" },
    영업전략: { keywords: ["사업화", "전략", "마케팅"], strength: "partial" },
    판로개척: { keywords: ["사업화", "전략", "마케팅"], strength: "partial" },
    수출계획: { keywords: ["사업화", "전략", "해외"], strength: "partial" },
    해외진출: { keywords: ["사업화", "전략", "해외"], strength: "partial" },
    성장전략: { keywords: ["사업화", "전략", "성장"], strength: "exact" },
    추진계획: { keywords: ["사업화", "일정", "전략"], strength: "partial" },
    추진일정: { keywords: ["일정", "로드맵", "전략"], strength: "exact" },

    // ===== 자금/예산 관련 =====
    자금소요: { keywords: ["자금", "예산", "재무"], strength: "exact" },
    자금조달: { keywords: ["자금", "조달", "재무"], strength: "exact" },
    사업비: { keywords: ["예산", "자금", "사업비"], strength: "exact" },
    예산계획: { keywords: ["예산", "자금"], strength: "exact" },
    소요예산: { keywords: ["예산", "자금"], strength: "exact" },
    재무현황: { keywords: ["재무", "자금", "매출"], strength: "partial" },
    매출계획: { keywords: ["사업화", "매출", "전략"], strength: "partial" },
    투자유치: { keywords: ["자금", "투자", "전략"], strength: "partial" },
    원가구조: { keywords: ["예산", "자금", "원가"], strength: "partial" },

    // ===== 팀 관련 =====
    대표자이력: { keywords: ["팀", "대표", "이력"], strength: "exact" },
    대표자: { keywords: ["팀", "대표"], strength: "exact" },
    팀원현황: { keywords: ["팀", "구성", "인력"], strength: "exact" },
    팀구성: { keywords: ["팀", "구성"], strength: "exact" },
    인력현황: { keywords: ["팀", "인력", "구성"], strength: "exact" },
    조직현황: { keywords: ["팀", "조직", "구성"], strength: "exact" },
    채용계획: { keywords: ["팀", "인력", "채용"], strength: "partial" },
    핵심인력: { keywords: ["팀", "인력", "핵심"], strength: "partial" },

    // ===== 기술 관련 =====
    기술현황: { keywords: ["기술", "개발", "특허"], strength: "exact" },
    기술개발: { keywords: ["기술", "개발"], strength: "exact" },
    기술수준: { keywords: ["기술", "개발", "현황"], strength: "partial" },
    특허현황: { keywords: ["기술", "특허", "지식재산"], strength: "exact" },
    특허출원: { keywords: ["기술", "특허"], strength: "partial" },
    핵심역량: { keywords: ["기술", "역량", "차별"], strength: "partial" },
    차별성: { keywords: ["기술", "차별", "경쟁"], strength: "partial" },
    연구개발: { keywords: ["기술", "개발", "연구"], strength: "partial" },

    // ===== 배경/필요성 =====
    추진배경: { keywords: ["배경", "필요성", "개요"], strength: "exact" },
    필요성: { keywords: ["배경", "필요성"], strength: "exact" },
    사업배경: { keywords: ["배경", "필요성", "개요"], strength: "exact" },
    개발배경: { keywords: ["배경", "필요성", "기술"], strength: "partial" },

    // ===== 성과/효과 =====
    기대효과: { keywords: ["기대", "효과", "성과"], strength: "exact" },
    사회적가치: { keywords: ["기대", "효과", "사회"], strength: "partial" },
    고용계획: { keywords: ["기대", "효과", "고용"], strength: "partial" },
    소셜임팩트: { keywords: ["기대", "효과", "사회"], strength: "partial" },
    주요실적: { keywords: ["현황", "실적"], strength: "partial" },
    수상이력: { keywords: ["현황", "실적", "수상"], strength: "partial" },

    // ===== 기업현황 =====
    기업현황: { keywords: ["현황", "기업", "일반"], strength: "exact" },
    일반현황: { keywords: ["현황", "일반", "기업"], strength: "exact" },
    법인설립: { keywords: ["현황", "기업", "설립"], strength: "partial" },
    회사소개: { keywords: ["현황", "기업", "소개"], strength: "partial" },

    // ===== 기타 =====
    리스크: { keywords: ["전략", "리스크", "대응"], strength: "partial" },
    위험관리: { keywords: ["전략", "리스크", "대응"], strength: "partial" },
    협력네트워크: { keywords: ["팀", "협력", "파트너"], strength: "partial" },
    멘토링: { keywords: ["팀", "멘토", "자문"], strength: "partial" },

    // ===== 소상공인/정책자금 추가 =====
    창업동기: { keywords: ["배경", "필요성", "개요"], strength: "exact" },
    사업목적: { keywords: ["배경", "필요성", "개요"], strength: "exact" },
    사업내용: { keywords: ["아이템", "개요", "소개"], strength: "exact" },
    업종: { keywords: ["현황", "기업", "업종"], strength: "partial" },
    창업경력: { keywords: ["팀", "대표", "이력"], strength: "partial" },
    사업장현황: { keywords: ["현황", "기업"], strength: "partial" },
    매장현황: { keywords: ["현황", "기업", "매장"], strength: "partial" },
    점포현황: { keywords: ["현황", "기업", "매장"], strength: "partial" },
    자금용도: { keywords: ["예산", "자금", "용도"], strength: "exact" },
    상환계획: { keywords: ["자금", "재무", "상환"], strength: "exact" },
    담보현황: { keywords: ["자금", "재무", "담보"], strength: "partial" },
    보증현황: { keywords: ["자금", "재무", "보증"], strength: "partial" },

    // ===== R&D 과제 추가 =====
    연구목표: { keywords: ["기술", "개발", "목표"], strength: "exact" },
    연구내용: { keywords: ["기술", "개발", "연구"], strength: "exact" },
    기술개발목표: { keywords: ["기술", "개발", "목표"], strength: "exact" },
    기술개발내용: { keywords: ["기술", "개발", "연구"], strength: "exact" },
    선행연구: { keywords: ["기술", "연구", "현황"], strength: "partial" },
    기술로드맵: { keywords: ["기술", "개발", "로드맵"], strength: "exact" },
    연구방법: { keywords: ["기술", "개발", "방법"], strength: "partial" },
    연구인력: { keywords: ["팀", "연구", "인력"], strength: "exact" },
    연구장비: { keywords: ["기술", "장비", "연구"], strength: "partial" },
    연구비: { keywords: ["예산", "자금", "연구"], strength: "exact" },
    사업화계획: { keywords: ["사업화", "전략", "계획"], strength: "exact" },
    활용방안: { keywords: ["사업화", "전략", "활용"], strength: "partial" },
    기술이전: { keywords: ["기술", "이전", "사업화"], strength: "partial" },
  };

  for (const field of fields) {
    // 라벨에서 공백/특수문자 제거하여 키워드 매칭
    const normalizedLabel = field.label
      .replace(/[\s\-_.:：()（）]/g, "")
      .trim();

    let bestMatch: { keyword: string; sectionKeywords: string[]; confidence: number } | null = null;

    for (const [keyword, { keywords: sectionKeywords, strength }] of Object.entries(KEYWORD_MAP)) {
      let matchConfidence = 0;

      if (normalizedLabel === keyword) {
        // 완전 일치 → 최고 confidence
        matchConfidence = strength === "exact" ? 95 : 90;
      } else if (normalizedLabel.includes(keyword)) {
        // 라벨이 키워드를 포함
        matchConfidence = strength === "exact" ? 90 : 80;
      } else if (keyword.includes(normalizedLabel) && normalizedLabel.length >= 2) {
        // 키워드가 라벨을 포함 (라벨이 짧은 경우)
        matchConfidence = strength === "exact" ? 75 : 65;
      }

      if (matchConfidence > 0 && (!bestMatch || matchConfidence > bestMatch.confidence)) {
        bestMatch = { keyword, sectionKeywords, confidence: matchConfidence };
      }
    }

    if (bestMatch) {
      // 가장 적합한 섹션 찾기
      const bestSection = findBestSection(sections, bestMatch.sectionKeywords);
      if (bestSection) {
        // 스킬 힌트에서 가이드/길이 정보 활용
        const hint = skillHints?.get(field.id);
        const maxLen = hint?.maxLength || (field.type === "text" ? 100 : 2000);
        const guide = hint?.expectedContent || "";

        mappings.push({
          formFieldId: field.id,
          formFieldLabel: field.label,
          planSectionOrder: bestSection.section_order,
          planSectionName: bestSection.section_name,
          strategy: field.type === "textarea" ? "direct" : "extract",
          confidence: bestMatch.confidence,
          extractPrompt:
            field.type !== "textarea"
              ? `다음 내용에서 "${field.label}"에 해당하는 내용만 간결하게 추출해주세요.${guide ? ` (형식: ${guide})` : ""} 최대 ${maxLen}자.`
              : guide
                ? `${guide} 최대 ${maxLen}자 이내로 작성.`
                : undefined,
        });
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
  planSections: PlanSection[],
  skillHints?: Map<string, FormSkillField>
): Promise<FieldMapping[]> {
  const fieldsList = unmappedFields
    .map((f) => {
      const hint = skillHints?.get(f.id);
      const guide = hint?.expectedContent ? `, 가이드: "${hint.expectedContent}"` : "";
      const maxLen = hint?.maxLength ? `, 최대${hint.maxLength}자` : "";
      return `- ID: ${f.id}, 라벨: "${f.label}", 유형: ${f.type}, 컨텍스트: "${f.context.sectionTitle} > ${f.context.subsectionTitle}"${guide}${maxLen}`;
    })
    .join("\n");

  const sectionsList = planSections
    .map((s) => {
      const preview = s.content
        ? s.content.substring(0, 200).replace(/\n/g, " ")
        : "(미작성)";
      return `- 섹션 ${s.section_order}: "${s.section_name}" → ${preview}...`;
    })
    .join("\n");

  const prompt = `한국 정부지원사업 양식 필드와 사업계획서 섹션을 매핑해주세요.

## 양식 필드 (작성해야 할 칸):
${fieldsList}

## 사업계획서 섹션 (참고할 내용):
${sectionsList}

## 매핑 규칙:
1. 각 양식 필드에 대해, 가장 관련성 높은 사업계획서 섹션을 1개 선택합니다.
2. 필드 라벨, 컨텍스트(상위 섹션 제목), 가이드를 종합적으로 고려합니다.
3. "사업명", "회사명", "대표자" 등 단답형 필드 → strategy: "extract"
4. "사업내용", "시장분석" 등 서술형 필드 → strategy: "direct" 또는 "summarize"
5. 어떤 섹션에도 관련 내용이 없는 필드 → strategy: "skip" (최소화!)
6. extractPrompt에는 반드시 한국어로 구체적인 추출/요약 지시를 작성하세요.

## 출력 형식:
JSON 배열 (필드마다 하나):
[{
  "formFieldId": "field_id",
  "formFieldLabel": "필드명",
  "planSectionOrder": 섹션번호,
  "planSectionName": "섹션명",
  "strategy": "direct|extract|summarize|skip",
  "confidence": 0-100,
  "extractPrompt": "추출 지시문 (strategy가 extract/summarize일 때)"
}]

JSON 배열만 반환하세요.`;

  try {
    const response = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system: `당신은 한국 정부지원사업 사업계획서 양식 전문가입니다.
양식 필드(라벨+컨텍스트)를 분석하여 사업계획서 섹션과 정확히 매핑합니다.
핵심 규칙:
- skip은 정말 매칭할 섹션이 없을 때만 사용 (최소화)
- 하나의 섹션에 여러 필드가 매핑될 수 있음
- extractPrompt는 구체적이고 명확하게 작성
- JSON 배열만 반환하세요.`,
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
 * @param formSkill - 스킬 정보 (maxLength 등 활용)
 */
export async function generateFieldContents(
  mappings: FieldMapping[],
  planSections: PlanSection[],
  formSkill?: FormSkill
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  const sectionMap = new Map(
    planSections.map((s) => [s.section_order, s])
  );

  // 스킬 정보에서 maxLength 맵 구성
  const maxLengthMap = new Map<string, number>();
  if (formSkill) {
    for (const sf of formSkill.fields) {
      maxLengthMap.set(sf.id, sf.maxLength);
    }
  }

  // direct 매핑은 즉시 처리
  const aiTasks: Array<{
    fieldId: string;
    mapping: FieldMapping;
    sectionContent: string;
    maxLength: number;
  }> = [];

  for (const mapping of mappings) {
    if (mapping.strategy === "skip") continue;

    const section = sectionMap.get(mapping.planSectionOrder);
    if (!section?.content) continue;

    const maxLen = maxLengthMap.get(mapping.formFieldId) || 2000;

    if (mapping.strategy === "direct") {
      // direct도 maxLength 초과 시 잘라내기
      contents[mapping.formFieldId] = truncateContent(section.content, maxLen);
    } else {
      aiTasks.push({
        fieldId: mapping.formFieldId,
        mapping,
        sectionContent: section.content,
        maxLength: maxLen,
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
최대 글자수: ${task.maxLength}자 이내
원본 내용:
${task.sectionContent.substring(0, 2000)}`
      )
      .join("\n\n---\n\n");

    try {
      const response = await callClaude({
        model: "claude-haiku-4-5-20251001",
        system: `한국 정부지원사업 사업계획서 양식을 채우는 전문가입니다.
각 필드에 맞는 내용을 원본에서 추출하거나 요약하여 작성합니다.

핵심 규칙:
1. 각 필드의 "최대 글자수"를 반드시 지킵니다. 초과하면 양식이 깨집니다.
2. 단답형 필드(사업명, 대표자, 업종 등)는 핵심만 간결하게.
3. 서술형 필드(사업내용, 시장분석 등)는 구조적으로 작성 (번호, 줄바꿈 활용).
4. 숫자/금액은 원문 그대로 정확하게 추출합니다.
5. 표 형식이 요구되면 탭(\t)이나 줄바꿈(\n)으로 구분합니다.
6. 마크다운 문법(**, ##)은 사용하지 않습니다. 순수 텍스트만.

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
            // AI 결과도 maxLength 초과 시 잘라내기 (안전장치)
            contents[task.fieldId] = truncateContent(text, task.maxLength);
          }
        }
      }
    } catch (error) {
      console.warn("[field-mapper] AI 콘텐츠 생성 실패:", error);
      // 실패 시 원본 내용을 길이 제한하여 사용
      for (const task of aiTasks) {
        contents[task.fieldId] = truncateContent(task.sectionContent, task.maxLength);
      }
    }
  }

  return contents;
}

/**
 * 내용이 maxLength를 초과하면 자연스럽게 잘라내기
 * 문장 단위로 잘라서 "..."으로 끝맺음
 */
function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;

  // 마지막 완전한 문장까지만 사용
  const truncated = content.substring(0, maxLength);
  const lastSentenceEnd = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("다."),
    truncated.lastIndexOf("요."),
    truncated.lastIndexOf("함."),
    truncated.lastIndexOf("\n")
  );

  if (lastSentenceEnd > maxLength * 0.5) {
    return truncated.substring(0, lastSentenceEnd + 1);
  }

  // 문장 단위 잘림이 안 되면 그냥 잘라내기
  return truncated.trimEnd() + "...";
}
