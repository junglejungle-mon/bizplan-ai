/**
 * 공고 ↔ 사업계획서 매칭 점수 시스템
 *
 * 공고 지침서 요구사항과 사업계획서 충족도를 비교하여 점수화합니다.
 * 대표님 요구사항: "공고 사업 지침서랑 똑같이 사업계획서가 왔는지? 공고 내용과 매칭해서 사업계획서 똑같이 나오는 거에 점수 필요"
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ===== Types =====

export interface ProgramRequirement {
  section_name: string;     // 공고 요구 섹션명
  keywords: string[];       // 평가에서 찾아야 할 키워드
  weight: number;           // 배점 비중 (%)
  guidelines: string;       // 작성 지침
}

export interface MatchScoreResult {
  plan_id: string;
  program_id: string;
  overall_score: number;             // 0~100 전체 매칭 점수
  section_scores: SectionMatchScore[];
  grade: "A" | "B" | "C" | "D";     // A=80+, B=60+, C=40+, D=<40
  is_submittable: boolean;           // "그대로 제출 가능" 여부 (A등급)
  missing_sections: string[];        // 누락된 섹션
  improvement_tips: string[];        // 개선 팁 (상위 5개)
}

export interface SectionMatchScore {
  section_name: string;
  program_requirement: string;  // 공고 요구사항
  plan_section_id?: string;     // 매칭된 사업계획서 섹션 ID
  plan_section_name?: string;   // 매칭된 사업계획서 섹션명
  score: number;                // 0~100 해당 섹션 점수
  breakdown: {
    structure_match: number;    // 구조 일치도 (0~25)
    keyword_coverage: number;   // 키워드 포함도 (0~25)
    content_depth: number;      // 내용 충실도 (0~25)
    data_evidence: number;      // 수치/근거 충분도 (0~25)
  };
  status: "excellent" | "good" | "needs_work" | "missing";
  tip?: string;
}

// ===== 섹션명 매칭 유틸리티 =====

/** 섹션명 정규화 (공백, 괄호, 번호 제거) */
function normalizeSectionName(name: string): string {
  return name
    .replace(/\d+[\.\-\)]/g, "")       // 번호 제거 (1., 1-, 1))
    .replace(/[()[\]{}]/g, "")          // 괄호 제거
    .replace(/\s+/g, "")               // 공백 제거
    .toLowerCase()
    .trim();
}

/** 두 섹션명이 매칭되는지 확인 (유사도 기반) */
function isSectionMatch(requirement: string, planSection: string): boolean {
  const normReq = normalizeSectionName(requirement);
  const normPlan = normalizeSectionName(planSection);

  // 완전 일치
  if (normReq === normPlan) return true;

  // 포함 관계
  if (normReq.includes(normPlan) || normPlan.includes(normReq)) return true;

  // 핵심 키워드 매칭
  const reqKeywords = extractCoreKeywords(normReq);
  const planKeywords = extractCoreKeywords(normPlan);

  const overlap = reqKeywords.filter((k) => planKeywords.some((pk) => pk.includes(k) || k.includes(pk)));
  return overlap.length > 0 && overlap.length >= Math.min(reqKeywords.length, planKeywords.length) * 0.5;
}

/** 핵심 키워드 추출 */
function extractCoreKeywords(normalized: string): string[] {
  const keywords: string[] = [];
  const patterns = [
    "문제", "인식", "아이템", "개요", "실현", "가능성", "성장", "전략",
    "팀", "구성", "역량", "시장", "분석", "기술", "개발", "사업화",
    "실적", "경쟁", "차별", "예산", "사업비", "일정", "추진", "로드맵",
    "기대효과", "파급", "기업", "현황", "소개", "수출", "마케팅",
    "재무", "수익", "모델", "리스크", "위험", "특허", "ip",
  ];

  for (const p of patterns) {
    if (normalized.includes(p)) {
      keywords.push(p);
    }
  }

  return keywords;
}

// ===== 매칭 점수 계산 =====

function countKeywordHits(content: string, keywords: string[]): number {
  if (keywords.length === 0) return 1; // 키워드 없으면 만점
  const hits = keywords.filter((kw) => content.toLowerCase().includes(kw.toLowerCase()));
  return hits.length / keywords.length;
}

function assessContentDepth(content: string): number {
  const length = content.length;
  if (length >= 3500) return 25;
  if (length >= 2500) return 20;
  if (length >= 1500) return 15;
  if (length >= 800) return 10;
  if (length >= 300) return 5;
  return 0;
}

function assessDataEvidence(content: string): number {
  let score = 0;

  // 수치 데이터 (숫자+단위)
  const numericPatterns = /\d{1,3}(?:,\d{3})+|\d+\.?\d*\s*(?:억|만|조|%|원|건|명|개)/g;
  const numericCount = (content.match(numericPatterns) || []).length;
  if (numericCount >= 6) score += 10;
  else if (numericCount >= 3) score += 6;
  else if (numericCount >= 1) score += 3;

  // 표/테이블
  const tableCount = (content.match(/^\|.+\|$/gm) || []).length;
  if (tableCount >= 6) score += 8;
  else if (tableCount >= 3) score += 5;
  else if (tableCount >= 1) score += 2;

  // 출처/근거
  const sourceKeywords = ["출처", "자료", "통계", "보고서", "기준", "년", "월", "분기"];
  const sourceHits = sourceKeywords.filter((kw) => content.includes(kw)).length;
  if (sourceHits >= 3) score += 7;
  else if (sourceHits >= 1) score += 4;

  return Math.min(25, score);
}

function scoreSectionMatch(
  requirement: ProgramRequirement,
  planContent: string | null,
): Omit<SectionMatchScore, "plan_section_id" | "plan_section_name" | "program_requirement"> {
  if (!planContent || planContent.trim().length === 0) {
    return {
      section_name: requirement.section_name,
      score: 0,
      breakdown: { structure_match: 0, keyword_coverage: 0, content_depth: 0, data_evidence: 0 },
      status: "missing",
      tip: `"${requirement.section_name}" 섹션이 누락되었습니다. 공고 지침에 맞춰 작성해주세요.`,
    };
  }

  // 1. 구조 일치도 (0~25) — 섹션이 존재하면 기본 15점, 지침서 키워드 매칭으로 추가 점수
  const guidelineKeywords = requirement.guidelines
    ? requirement.guidelines.split(/[,.\s]+/).filter((w) => w.length > 1).slice(0, 10)
    : [];
  const guidelineHitRate = countKeywordHits(planContent, guidelineKeywords);
  const structure_match = Math.round(15 + guidelineHitRate * 10);

  // 2. 키워드 포함도 (0~25)
  const keywordHitRate = countKeywordHits(planContent, requirement.keywords);
  const keyword_coverage = Math.round(keywordHitRate * 25);

  // 3. 내용 충실도 (0~25)
  const content_depth = assessContentDepth(planContent);

  // 4. 수치/근거 충분도 (0~25)
  const data_evidence = assessDataEvidence(planContent);

  const totalScore = structure_match + keyword_coverage + content_depth + data_evidence;
  const status: SectionMatchScore["status"] =
    totalScore >= 80 ? "excellent" : totalScore >= 60 ? "good" : "needs_work";

  // 개선 팁 생성
  let tip: string | undefined;
  if (keyword_coverage < 15) {
    const missingKws = requirement.keywords.filter((kw) => !planContent.toLowerCase().includes(kw.toLowerCase()));
    if (missingKws.length > 0) {
      tip = `핵심 키워드 보완 필요: ${missingKws.slice(0, 3).join(", ")}`;
    }
  } else if (data_evidence < 15) {
    tip = "수치 데이터와 근거 자료를 보강하세요 (통계, 표, 그래프 등)";
  } else if (content_depth < 15) {
    tip = "내용을 더 구체적으로 작성하세요 (최소 2,000자 이상 권장)";
  }

  return {
    section_name: requirement.section_name,
    score: totalScore,
    breakdown: { structure_match, keyword_coverage, content_depth, data_evidence },
    status,
    tip,
  };
}

// ===== 공개 API =====

/**
 * 공고 요구사항 추출 (공고 지침서 텍스트에서)
 * 이미 plan-generator의 Stage 0에서 추출한 데이터를 활용
 */
export function extractProgramRequirements(
  sections: Array<{ section_name: string; guidelines?: string; section_order?: number }>,
  evalCriteria?: Array<{ 항목: string; 배점: number; 세부기준?: string }>,
): ProgramRequirement[] {
  const requirements: ProgramRequirement[] = [];

  for (const section of sections) {
    // 평가 기준에서 해당 섹션 관련 키워드 추출
    const relatedCriteria = evalCriteria?.filter((c) =>
      isSectionMatch(c.항목, section.section_name)
    );

    const keywords: string[] = [];
    if (section.guidelines) {
      // 가이드라인에서 핵심 키워드 추출
      const words = section.guidelines
        .replace(/[,.()]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 2 && !/^[0-9]+$/.test(w));
      keywords.push(...words.slice(0, 15));
    }

    if (relatedCriteria && relatedCriteria.length > 0) {
      for (const c of relatedCriteria) {
        if (c.세부기준) {
          const criteriaWords = c.세부기준
            .replace(/[,.()]/g, " ")
            .split(/\s+/)
            .filter((w) => w.length >= 2);
          keywords.push(...criteriaWords.slice(0, 10));
        }
      }
    }

    // 배점 비중 계산
    const weight = relatedCriteria && relatedCriteria.length > 0
      ? relatedCriteria.reduce((sum, c) => sum + c.배점, 0)
      : Math.round(100 / sections.length);

    requirements.push({
      section_name: section.section_name,
      keywords: [...new Set(keywords)], // 중복 제거
      weight,
      guidelines: section.guidelines || "",
    });
  }

  return requirements;
}

/**
 * 공고 ↔ 사업계획서 매칭 점수 계산
 */
export async function calculateProgramMatchScore(
  planId: string,
  programId: string,
): Promise<MatchScoreResult> {
  const supabase = createAdminClient();

  // 1. 사업계획서 섹션 로드
  const { data: planSections, error: planError } = await supabase
    .from("plan_sections")
    .select("id, section_name, content, section_order")
    .eq("plan_id", planId)
    .order("section_order", { ascending: true });

  if (planError) throw new Error(`Plan sections 로드 실패: ${planError.message}`);
  if (!planSections?.length) throw new Error("사업계획서 섹션이 없습니다.");

  // 2. 공고 정보 로드 (extracted_guidelines, eval_criteria)
  const { data: plan } = await supabase
    .from("business_plans")
    .select("program_id, template_type, extracted_sections, eval_criteria")
    .eq("id", planId)
    .single();

  // 3. 공고 요구사항 구성
  let requirements: ProgramRequirement[];

  if (plan?.extracted_sections && Array.isArray(plan.extracted_sections)) {
    requirements = extractProgramRequirements(
      plan.extracted_sections as Array<{ section_name: string; guidelines?: string }>,
      plan.eval_criteria as Array<{ 항목: string; 배점: number; 세부기준?: string }> || undefined,
    );
  } else {
    // 추출된 섹션이 없으면 사업계획서 섹션 자체를 기준으로 사용
    requirements = planSections.map((s) => ({
      section_name: s.section_name || "알 수 없는 섹션",
      keywords: [],
      weight: Math.round(100 / planSections.length),
      guidelines: "",
    }));
  }

  // 4. 매칭 점수 계산
  const sectionScores: SectionMatchScore[] = [];
  const missingSections: string[] = [];
  const tips: string[] = [];

  for (const req of requirements) {
    // 가장 잘 매칭되는 사업계획서 섹션 찾기
    const matchedSection = planSections.find((s) =>
      isSectionMatch(req.section_name, s.section_name || "")
    );

    const scoreResult = scoreSectionMatch(req, matchedSection?.content || null);

    const sectionScore: SectionMatchScore = {
      ...scoreResult,
      program_requirement: req.guidelines,
      plan_section_id: matchedSection?.id,
      plan_section_name: matchedSection?.section_name || undefined,
    };

    sectionScores.push(sectionScore);

    if (sectionScore.status === "missing") {
      missingSections.push(req.section_name);
    }

    if (sectionScore.tip) {
      tips.push(`[${req.section_name}] ${sectionScore.tip}`);
    }
  }

  // 5. 가중 평균 계산
  const totalWeight = requirements.reduce((sum, r) => sum + r.weight, 0);
  const weightedScore = requirements.reduce((sum, req, i) => {
    const sScore = sectionScores[i]?.score || 0;
    return sum + (sScore * req.weight) / (totalWeight || 1);
  }, 0);

  const overallScore = Math.round(weightedScore);
  const grade: MatchScoreResult["grade"] =
    overallScore >= 80 ? "A" : overallScore >= 60 ? "B" : overallScore >= 40 ? "C" : "D";

  // 6. 결과 저장 (matchings 테이블에 match_score 업데이트 가능)
  try {
    await supabase
      .from("business_plans")
      .update({
        match_score: overallScore,
        match_grade: grade,
      })
      .eq("id", planId);
  } catch (e) {
    console.warn("[ProgramMatchScorer] match_score 저장 실패 (컬럼 미존재 가능):", e);
  }

  return {
    plan_id: planId,
    program_id: programId,
    overall_score: overallScore,
    section_scores: sectionScores,
    grade,
    is_submittable: grade === "A",
    missing_sections: missingSections,
    improvement_tips: tips.slice(0, 5),
  };
}
