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
// autoScoreSection – pure regex / keyword based scoring (no DB, no AI)
// ---------------------------------------------------------------------------

export function autoScoreSection(
  content: string,
  _sectionName: string,
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

  return {
    score_numeric_evidence,
    score_tam_sam_som,
    score_competitor_analysis,
    score_roadmap,
    score_team_capability,
    score_budget_basis,
    score_risk_mitigation,
    score_ip_patent,
    score_social_value,
    score_document_fit,
    score_charts_tables,
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
): string[] {
  const suggestions: string[] = [];

  if (scores.score_numeric_evidence < 10) {
    suggestions.push(
      "구체적인 수치 데이터(매출, 시장규모, 성장률 등)를 추가하여 신뢰성을 높이세요.",
    );
  }
  if (scores.score_tam_sam_som < 7) {
    suggestions.push(
      "TAM(전체시장), SAM(유효시장), SOM(목표시장) 분석을 포함하세요.",
    );
  }
  if (scores.score_competitor_analysis < 10) {
    suggestions.push(
      "경쟁사 비교 분석 표를 추가하여 차별점을 명확히 하세요.",
    );
  }
  if (scores.score_roadmap < 10) {
    suggestions.push(
      "분기별/월별 실행 로드맵 테이블을 추가하세요.",
    );
  }
  if (scores.score_team_capability < 5) {
    suggestions.push(
      "핵심 인력의 학력, 경력, 주요 실적을 구체적으로 기술하세요.",
    );
  }
  if (scores.score_budget_basis < 10) {
    suggestions.push(
      "예산 항목별 단가, 수량, 산출근거를 표로 정리하세요.",
    );
  }
  if (scores.score_risk_mitigation < 3) {
    suggestions.push(
      "주요 리스크와 대응 방안을 구체적으로 서술하세요.",
    );
  }
  if (scores.score_ip_patent < 3) {
    suggestions.push(
      "보유 특허나 지식재산권 정보를 추가하세요.",
    );
  }
  if (scores.score_social_value < 3) {
    suggestions.push(
      "ESG, 고용창출 등 사회적 가치 기여 내용을 포함하세요.",
    );
  }
  if (scores.score_document_fit < 7) {
    suggestions.push(
      "섹션 내용을 더 충실하게 작성하세요 (최소 2,000자 이상 권장).",
    );
  }
  if (scores.score_charts_tables < 7) {
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

  const improvement_suggestions = generateSuggestions(scores);

  const row = {
    plan_id: planId,
    section_id: sectionId,
    ...scores,
    total_score,
    improvement_suggestions,
    scored_at: new Date().toISOString(),
  };

  // Upsert – if a score already exists for this plan+section, update it
  const { data, error } = await supabase
    .from("quality_scores")
    .upsert(row, { onConflict: "plan_id,section_id" })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save quality score: ${error.message}`);
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
