import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QualityScoreResult {
  id?: string;
  plan_id: string;
  section_id: string;
  score_numeric_evidence: number;   // max 15
  score_tam_sam_som: number;        // max 10
  score_competitor_analysis: number; // max 10
  score_roadmap: number;            // max 10
  score_team_capability: number;    // max 10
  score_budget_basis: number;       // max 10
  score_risk_mitigation: number;    // max  5
  score_ip_patent: number;          // max  5
  score_social_value: number;       // max  5
  score_document_fit: number;       // max 10
  score_charts_tables: number;      // max 10
  total_score: number;              // max 100
  improvement_suggestions: string[];
  scored_at?: string;
  created_at?: string;
  updated_at?: string;
}

// ---------------------------------------------------------------------------
// Helpers – counting utilities
// ---------------------------------------------------------------------------

function countMatches(content: string, pattern: RegExp): number {
  const matches = content.match(pattern);
  return matches ? matches.length : 0;
}

function hasKeywords(content: string, keywords: string[]): number {
  return keywords.filter((kw) => content.includes(kw)).length;
}

// ---------------------------------------------------------------------------
// Section type classification – determines which scoring dimensions matter
// ---------------------------------------------------------------------------

type SectionType =
  | "market"      // 시장/문제 분석
  | "product"     // 아이템/제품/서비스 소개
  | "team"        // 팀 구성/역량
  | "strategy"    // 사업화 전략/마케팅
  | "budget"      // 사업비/예산
  | "technology"  // 기술개발/R&D
  | "company"     // 기업 현황/소개
  | "schedule"    // 추진 일정
  | "impact"      // 기대 효과/파급 효과
  | "general";    // 기타/일반

/** 섹션명으로 섹션 유형 분류 */
function classifySectionType(sectionName: string): SectionType {
  const name = sectionName.toLowerCase().replace(/\s+/g, "");

  // 기업 현황 (기업소개, 회사현황 등)
  if (/기업현황|기업소개|회사현황|회사소개|법인|연혁|조직현황/.test(name)) return "company";
  // 기대 효과/파급 효과
  if (/기대효과|파급효과|기대성과|성과목표|효과|impact/.test(name)) return "impact";
  // 추진 일정
  if (/추진일정|일정계획|실행일정|schedule/.test(name)) return "schedule";
  // 시장/문제 분석
  if (/시장|market|타겟|고객|문제|pain|니즈|tam|sam|som|경쟁/.test(name)) return "market";
  // 팀 구성
  if (/팀|인력|조직|대표|인적|구성원|멤버/.test(name)) return "team";
  // 사업비/예산
  if (/사업비|예산|자금|비용|재무|budget|투자|소요예산/.test(name)) return "budget";
  // 기술개발
  if (/기술|개발|r&d|연구|특허|ip|지식재산/.test(name)) return "technology";
  // 사업화 전략
  if (/사업화|전략|마케팅|수익|판매|출시|strategy/.test(name)) return "strategy";
  // 아이템/제품
  if (/아이템|제품|서비스|솔루션|개요|소개|배경|필요성/.test(name)) return "product";

  return "general";
}

/** 섹션 유형별 가중치 테이블 (각 항목의 배점 비율, 합계 100) */
const SECTION_WEIGHTS: Record<SectionType, Record<string, number>> = {
  market: {
    numeric_evidence: 20, tam_sam_som: 25, competitor_analysis: 20,
    roadmap: 0, team_capability: 0, budget_basis: 0,
    risk_mitigation: 0, ip_patent: 0, social_value: 0,
    document_fit: 20, charts_tables: 15,
  },
  product: {
    numeric_evidence: 10, tam_sam_som: 5, competitor_analysis: 10,
    roadmap: 5, team_capability: 0, budget_basis: 0,
    risk_mitigation: 5, ip_patent: 10, social_value: 5,
    document_fit: 30, charts_tables: 20,
  },
  team: {
    numeric_evidence: 5, tam_sam_som: 0, competitor_analysis: 0,
    roadmap: 0, team_capability: 40, budget_basis: 0,
    risk_mitigation: 0, ip_patent: 15, social_value: 5,
    document_fit: 20, charts_tables: 15,
  },
  strategy: {
    numeric_evidence: 15, tam_sam_som: 5, competitor_analysis: 10,
    roadmap: 25, team_capability: 0, budget_basis: 5,
    risk_mitigation: 10, ip_patent: 0, social_value: 5,
    document_fit: 15, charts_tables: 10,
  },
  budget: {
    numeric_evidence: 25, tam_sam_som: 0, competitor_analysis: 0,
    roadmap: 5, team_capability: 0, budget_basis: 35,
    risk_mitigation: 0, ip_patent: 0, social_value: 0,
    document_fit: 10, charts_tables: 25,
  },
  technology: {
    numeric_evidence: 10, tam_sam_som: 5, competitor_analysis: 10,
    roadmap: 10, team_capability: 5, budget_basis: 0,
    risk_mitigation: 5, ip_patent: 25, social_value: 0,
    document_fit: 15, charts_tables: 15,
  },
  company: {
    // 기업 현황: 팀 역량, 특허/IP, 수치 근거, 표/차트, 문서 적합도 중심
    numeric_evidence: 15, tam_sam_som: 0, competitor_analysis: 0,
    roadmap: 0, team_capability: 25, budget_basis: 0,
    risk_mitigation: 0, ip_patent: 15, social_value: 0,
    document_fit: 25, charts_tables: 20,
  },
  schedule: {
    // 추진 일정: 로드맵, 수치, 표/차트 중심
    numeric_evidence: 15, tam_sam_som: 0, competitor_analysis: 0,
    roadmap: 35, team_capability: 0, budget_basis: 0,
    risk_mitigation: 5, ip_patent: 0, social_value: 0,
    document_fit: 15, charts_tables: 30,
  },
  impact: {
    // 기대 효과: 수치 근거, 사회적 가치, 문서 적합도 중심
    numeric_evidence: 25, tam_sam_som: 0, competitor_analysis: 0,
    roadmap: 0, team_capability: 0, budget_basis: 0,
    risk_mitigation: 0, ip_patent: 0, social_value: 20,
    document_fit: 30, charts_tables: 25,
  },
  general: {
    numeric_evidence: 15, tam_sam_som: 10, competitor_analysis: 10,
    roadmap: 10, team_capability: 10, budget_basis: 10,
    risk_mitigation: 5, ip_patent: 5, social_value: 5,
    document_fit: 10, charts_tables: 10,
  },
};

// ---------------------------------------------------------------------------
// autoScoreSection – pure regex / keyword based scoring (no DB, no AI)
// ---------------------------------------------------------------------------

export function autoScoreSection(
  content: string,
  sectionName: string,
): Omit<
  QualityScoreResult,
  | "id"
  | "plan_id"
  | "section_id"
  | "total_score"
  | "improvement_suggestions"
  | "scored_at"
  | "created_at"
  | "updated_at"
> {
  // 1. score_numeric_evidence (max 15)
  //    Count numeric patterns like 매출, 억원, %, 성장률, 만원, 조원, etc.
  const numericPatterns =
    /(?:매출|억원|만원|조원|%|퍼센트|성장률|CAGR|증가율|시장규모|연평균|\d{1,3}(?:,\d{3})+|\d+\.\d+%)/g;
  const numericCount = countMatches(content, numericPatterns);
  let score_numeric_evidence: number;
  if (numericCount >= 6) score_numeric_evidence = 15;
  else if (numericCount >= 3) score_numeric_evidence = 10;
  else if (numericCount >= 1) score_numeric_evidence = 5;
  else score_numeric_evidence = 0;

  // 2. score_tam_sam_som (max 10)
  const tamSamSomKeywords = ["TAM", "SAM", "SOM"];
  const tamSamSomFound = hasKeywords(content.toUpperCase(), tamSamSomKeywords);
  let score_tam_sam_som: number;
  if (tamSamSomFound >= 3) score_tam_sam_som = 10;
  else if (tamSamSomFound === 2) score_tam_sam_som = 7;
  else if (tamSamSomFound === 1) score_tam_sam_som = 4;
  else score_tam_sam_som = 0;

  // 3. score_competitor_analysis (max 10)
  //    Check for markdown table with competitor info
  const hasMarkdownTable = /\|.+\|.+\|/.test(content);
  const competitorKeywords = ["경쟁", "경쟁사", "경쟁업체", "비교", "차별화", "competitor"];
  const competitorMentions = hasKeywords(content.toLowerCase(), competitorKeywords.map((k) => k.toLowerCase()));
  let score_competitor_analysis: number;
  if (hasMarkdownTable && competitorMentions > 0) score_competitor_analysis = 10;
  else if (competitorMentions > 0) score_competitor_analysis = 5;
  else score_competitor_analysis = 0;

  // 4. score_roadmap (max 10)
  //    Check for timeline/roadmap table or 분기/월별 keywords
  const roadmapTablePattern = /\|.+(?:분기|Q[1-4]|월|년도|단계|Phase).+\|/i;
  const roadmapKeywords = ["분기", "월별", "로드맵", "마일스톤", "일정", "단계별", "Phase", "Timeline"];
  const hasRoadmapTable = roadmapTablePattern.test(content);
  const roadmapKeywordCount = hasKeywords(content, roadmapKeywords);
  let score_roadmap: number;
  if (hasRoadmapTable) score_roadmap = 10;
  else if (roadmapKeywordCount > 0) score_roadmap = 5;
  else score_roadmap = 0;

  // 5. score_team_capability (max 10)
  const teamKeywords = ["학력", "경력", "실적", "석사", "박사", "CTO", "CEO", "COO", "대표이사", "이력"];
  const teamKeywordCount = hasKeywords(content, teamKeywords);
  let score_team_capability: number;
  if (teamKeywordCount >= 4) score_team_capability = 10;
  else if (teamKeywordCount >= 2) score_team_capability = 5;
  else score_team_capability = 0;

  // 6. score_budget_basis (max 10)
  const budgetKeywords = ["단가", "수량", "산출근거", "산출내역", "예산", "비용"];
  const budgetKeywordCount = hasKeywords(content, budgetKeywords);
  const hasBudgetTable = /\|.+(?:단가|수량|금액|합계|산출).+\|/i.test(content);
  const hasNumberPatterns = /\d{1,3}(?:,\d{3})+/.test(content);
  let score_budget_basis: number;
  if (hasBudgetTable && hasNumberPatterns) score_budget_basis = 10;
  else if (budgetKeywordCount > 0) score_budget_basis = 5;
  else score_budget_basis = 0;

  // 7. score_risk_mitigation (max 5)
  const riskKeywords = ["리스크", "위험", "대응", "대책", "완화", "방안", "리스크관리"];
  const riskKeywordCount = hasKeywords(content, riskKeywords);
  let score_risk_mitigation: number;
  if (riskKeywordCount >= 3) score_risk_mitigation = 5;
  else if (riskKeywordCount >= 1) score_risk_mitigation = 3;
  else score_risk_mitigation = 0;

  // 8. score_ip_patent (max 5)
  const patentKeywords = ["특허", "출원", "등록", "IP", "지식재산", "실용신안"];
  const patentKeywordCount = hasKeywords(content, patentKeywords);
  // Patent number pattern: 10-XXXX-XXXXXXX or similar
  const hasPatentNumbers = /\d{2}-\d{4}-\d{4,}/.test(content);
  let score_ip_patent: number;
  if (hasPatentNumbers) score_ip_patent = 5;
  else if (patentKeywordCount > 0) score_ip_patent = 3;
  else score_ip_patent = 0;

  // 9. score_social_value (max 5)
  const socialKeywords = ["ESG", "고용창출", "사회적가치", "탄소", "사회적기업", "환경", "지속가능"];
  const socialKeywordCount = hasKeywords(content, socialKeywords);
  let score_social_value: number;
  if (socialKeywordCount >= 3) score_social_value = 5;
  else if (socialKeywordCount >= 1) score_social_value = 3;
  else score_social_value = 0;

  // 10. score_document_fit (max 10)
  const contentLength = content.length;
  let score_document_fit: number;
  if (contentLength >= 3500) score_document_fit = 10;
  else if (contentLength >= 2000) score_document_fit = 7;
  else if (contentLength >= 1000) score_document_fit = 4;
  else score_document_fit = 0;

  // 11. score_charts_tables (max 10)
  //     Count markdown tables by counting lines that start/contain | delimiters
  const tableRowPattern = /^\|.+\|$/gm;
  const tableRows = countMatches(content, tableRowPattern);
  // Rough heuristic: a markdown table needs at least 3 rows (header + separator + 1 data)
  // Count separator lines to estimate table count
  const tableSeparatorPattern = /^\|[\s:-]+\|$/gm;
  const tableCount = countMatches(content, tableSeparatorPattern);
  let score_charts_tables: number;
  if (tableCount >= 3) score_charts_tables = 10;
  else if (tableCount === 2) score_charts_tables = 7;
  else if (tableCount === 1) score_charts_tables = 4;
  else if (tableRows > 0) score_charts_tables = 2;
  else score_charts_tables = 0;

  // 섹션 유형별 가중치 적용
  const sectionType = classifySectionType(sectionName);
  const weights = SECTION_WEIGHTS[sectionType];

  // 각 항목의 raw 비율 (0~1) 계산 후 가중치 적용
  const rawScores: Record<string, { raw: number; max: number }> = {
    numeric_evidence:    { raw: score_numeric_evidence, max: 15 },
    tam_sam_som:         { raw: score_tam_sam_som, max: 10 },
    competitor_analysis: { raw: score_competitor_analysis, max: 10 },
    roadmap:             { raw: score_roadmap, max: 10 },
    team_capability:     { raw: score_team_capability, max: 10 },
    budget_basis:        { raw: score_budget_basis, max: 10 },
    risk_mitigation:     { raw: score_risk_mitigation, max: 5 },
    ip_patent:           { raw: score_ip_patent, max: 5 },
    social_value:        { raw: score_social_value, max: 5 },
    document_fit:        { raw: score_document_fit, max: 10 },
    charts_tables:       { raw: score_charts_tables, max: 10 },
  };

  // 가중치 적용: (raw / max) * weight → 해당 항목의 가중 점수
  // 결과는 원래 max 기준으로 스케일링하여 DB 호환성 유지
  for (const [key, { raw, max }] of Object.entries(rawScores)) {
    const weight = weights[key] || 0;
    const ratio = max > 0 ? raw / max : 0;
    // 가중 점수를 원래 max 범위로 스케일링 (DB 컬럼 호환)
    // 가중치가 0인 항목은 만점 처리 (해당 섹션과 무관한 항목)
    if (weight === 0) {
      rawScores[key] = { raw: max, max };
    } else {
      rawScores[key] = { raw: Math.round(ratio * max), max };
    }
  }

  return {
    score_numeric_evidence:    rawScores.numeric_evidence.raw,
    score_tam_sam_som:         rawScores.tam_sam_som.raw,
    score_competitor_analysis: rawScores.competitor_analysis.raw,
    score_roadmap:             rawScores.roadmap.raw,
    score_team_capability:     rawScores.team_capability.raw,
    score_budget_basis:        rawScores.budget_basis.raw,
    score_risk_mitigation:     rawScores.risk_mitigation.raw,
    score_ip_patent:           rawScores.ip_patent.raw,
    score_social_value:        rawScores.social_value.raw,
    score_document_fit:        rawScores.document_fit.raw,
    score_charts_tables:       rawScores.charts_tables.raw,
  };
}

// ---------------------------------------------------------------------------
// generateSuggestions – produce actionable improvement hints
// ---------------------------------------------------------------------------

function generateSuggestions(
  scores: Omit<
    QualityScoreResult,
    | "id"
    | "plan_id"
    | "section_id"
    | "total_score"
    | "improvement_suggestions"
    | "scored_at"
    | "created_at"
    | "updated_at"
  >,
  sectionName: string = "",
): string[] {
  const suggestions: string[] = [];
  const sectionType = classifySectionType(sectionName);
  const weights = SECTION_WEIGHTS[sectionType];

  // 가중치가 0인 항목(해당 섹션과 무관)은 제안하지 않음
  if (weights.numeric_evidence > 0 && scores.score_numeric_evidence < 10) {
    suggestions.push(
      "구체적인 수치 데이터(매출, 시장규모, 성장률 등)를 추가하여 신뢰성을 높이세요.",
    );
  }
  if (weights.tam_sam_som > 0 && scores.score_tam_sam_som < 7) {
    suggestions.push(
      "TAM(전체시장), SAM(유효시장), SOM(목표시장) 분석을 포함하세요.",
    );
  }
  if (weights.competitor_analysis > 0 && scores.score_competitor_analysis < 10) {
    suggestions.push(
      "경쟁사 비교 분석 표를 추가하여 차별점을 명확히 하세요.",
    );
  }
  if (weights.roadmap > 0 && scores.score_roadmap < 10) {
    suggestions.push(
      "분기별/월별 실행 로드맵 테이블을 추가하세요.",
    );
  }
  if (weights.team_capability > 0 && scores.score_team_capability < 5) {
    suggestions.push(
      "핵심 인력의 학력, 경력, 주요 실적을 구체적으로 기술하세요.",
    );
  }
  if (weights.budget_basis > 0 && scores.score_budget_basis < 10) {
    suggestions.push(
      "예산 항목별 단가, 수량, 산출근거를 표로 정리하세요.",
    );
  }
  if (weights.risk_mitigation > 0 && scores.score_risk_mitigation < 3) {
    suggestions.push(
      "주요 리스크와 대응 방안을 구체적으로 서술하세요.",
    );
  }
  if (weights.ip_patent > 0 && scores.score_ip_patent < 3) {
    suggestions.push(
      "보유 특허나 지식재산권 정보를 추가하세요.",
    );
  }
  if (weights.social_value > 0 && scores.score_social_value < 3) {
    suggestions.push(
      "ESG, 고용창출 등 사회적 가치 기여 내용을 포함하세요.",
    );
  }
  if (weights.document_fit > 0 && scores.score_document_fit < 7) {
    suggestions.push(
      "섹션 내용을 더 충실하게 작성하세요 (최소 2,000자 이상 권장).",
    );
  }
  if (weights.charts_tables > 0 && scores.score_charts_tables < 7) {
    suggestions.push(
      "데이터를 시각적으로 표현하는 표나 차트를 추가하세요.",
    );
  }

  return suggestions;
}

// ---------------------------------------------------------------------------
// scoreAndSave – score a single section and persist to DB
// ---------------------------------------------------------------------------

export async function scoreAndSave(
  planId: string,
  sectionId: string,
  content: string,
  sectionName: string,
): Promise<QualityScoreResult> {
  const supabase = createAdminClient();

  const scores = autoScoreSection(content, sectionName);

  const total_score =
    scores.score_numeric_evidence +
    scores.score_tam_sam_som +
    scores.score_competitor_analysis +
    scores.score_roadmap +
    scores.score_team_capability +
    scores.score_budget_basis +
    scores.score_risk_mitigation +
    scores.score_ip_patent +
    scores.score_social_value +
    scores.score_document_fit +
    scores.score_charts_tables;

  const improvement_suggestions = generateSuggestions(scores, sectionName);

  const row = {
    plan_id: planId,
    section_id: sectionId,
    ...scores,
    total_score,
    improvement_suggestions,
  };

  // 기존 점수 삭제 후 새로 삽입 (unique constraint 없으므로 upsert 대신)
  await supabase
    .from("quality_scores")
    .delete()
    .eq("plan_id", planId)
    .eq("section_id", sectionId);

  const { data, error } = await supabase
    .from("quality_scores")
    .insert(row)
    .select()
    .single();

  if (error) {
    // 스키마 불일치 등으로 저장 실패해도 점수 결과는 반환 (생성 중단 방지)
    console.error(`[scorer] Failed to save quality score: ${error.message} | code: ${error.code} | details: ${error.details}`);
    return {
      plan_id: planId,
      section_id: sectionId,
      ...scores,
      total_score,
      improvement_suggestions,
    } as QualityScoreResult;
  }

  return data as QualityScoreResult;
}

// ---------------------------------------------------------------------------
// scorePlan – score every section of a plan and update the plan average
// ---------------------------------------------------------------------------

export async function scorePlan(
  planId: string,
): Promise<QualityScoreResult[]> {
  const supabase = createAdminClient();

  // 1. Fetch all sections for the plan
  const { data: sections, error: sectionsError } = await supabase
    .from("plan_sections")
    .select("id, section_name, content")
    .eq("plan_id", planId)
    .order("section_order", { ascending: true });

  if (sectionsError) {
    throw new Error(`Failed to fetch plan sections: ${sectionsError.message}`);
  }

  if (!sections || sections.length === 0) {
    throw new Error(`No sections found for plan ${planId}`);
  }

  // 2. Score each section
  const results: QualityScoreResult[] = [];
  for (const section of sections) {
    const result = await scoreAndSave(
      planId,
      section.id,
      section.content ?? "",
      section.section_name ?? "",
    );
    results.push(result);
  }

  // 3. Calculate average total score
  const averageScore =
    results.reduce((sum, r) => sum + r.total_score, 0) / results.length;

  // 4. Update the plan's quality_score
  const { error: updateError } = await supabase
    .from("business_plans")
    .update({ quality_score: Math.round(averageScore) })
    .eq("id", planId);

  if (updateError) {
    throw new Error(
      `Failed to update plan quality score: ${updateError.message}`,
    );
  }

  return results;
}

// ---------------------------------------------------------------------------
// getScoresForPlan – read existing scores from DB
// ---------------------------------------------------------------------------

export async function getScoresForPlan(
  planId: string,
): Promise<QualityScoreResult[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("quality_scores")
    .select("*")
    .eq("plan_id", planId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch quality scores: ${error.message}`);
  }

  return (data ?? []) as QualityScoreResult[];
}
