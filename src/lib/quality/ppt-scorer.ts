/**
 * PPT/IR 품질 자동 채점 엔진
 * 슬라이드 데이터를 분석하여 8개 항목 100점 만점 자동 채점
 * (사업계획서 scorer.ts와 동일한 패턴: regex/keyword 기반, AI 불필요)
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PptScoreResult {
  presentation_id: string;
  score_text_density: number;       // max 15
  score_numeric_data: number;       // max 15
  score_visual_elements: number;    // max 15
  score_story_flow: number;         // max 15
  score_slide_count: number;        // max 10
  score_consistency: number;        // max 10
  score_data_source: number;        // max 10
  score_investor_appeal: number;    // max 10
  total_score: number;              // max 100
  details: Record<string, string>;
  improvement_suggestions: string[];
}

interface SlideInput {
  slide_type: string;
  title: string;
  content: {
    headline?: string;
    subtext?: string;
    bullets?: string[];
    data?: Record<string, unknown>;
    stats?: Array<{ icon?: string; value: string; label: string }>;
    chart?: { type: string; title?: string; data?: unknown };
  };
  notes?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function countMatches(text: string, pattern: RegExp): number {
  const m = text.match(pattern);
  return m ? m.length : 0;
}

function slideFullText(slide: SlideInput): string {
  const parts: string[] = [];
  if (slide.title) parts.push(slide.title);
  if (slide.content?.headline) parts.push(slide.content.headline);
  if (slide.content?.subtext) parts.push(slide.content.subtext);
  if (slide.content?.bullets) parts.push(...slide.content.bullets);
  if (slide.content?.stats) {
    parts.push(...slide.content.stats.map(s => `${s.value} ${s.label}`));
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// 황금 슬라이드 순서 (SKILL.md 기반)
// ---------------------------------------------------------------------------

const IDEAL_FLOW = [
  "cover", "problem", "solution", "market", "business_model",
  "traction", "competition", "tech", "team", "financials", "ask", "roadmap",
];

// ---------------------------------------------------------------------------
// autoScorePpt – 8개 항목 자동 채점
// ---------------------------------------------------------------------------

export function autoScorePpt(slides: SlideInput[]): Omit<PptScoreResult, "presentation_id"> {
  const details: Record<string, string> = {};
  const suggestions: string[] = [];

  const allText = slides.map(slideFullText);
  const avgChars = allText.reduce((sum, t) => sum + t.length, 0) / Math.max(slides.length, 1);

  // --- 1. 텍스트 밀도 (15점) ---
  let scoreDensity = 0;
  if (avgChars >= 50 && avgChars <= 200) {
    scoreDensity = 15; // 이상적
  } else if (avgChars > 200 && avgChars <= 300) {
    scoreDensity = 10; // 약간 많음
  } else if (avgChars > 300) {
    scoreDensity = 5;  // 텍스트 과다
    suggestions.push("슬라이드당 텍스트를 150자 이내로 줄이세요");
  } else if (avgChars < 50) {
    scoreDensity = 8;  // 너무 적음
    suggestions.push("핵심 메시지가 부족합니다. 슬라이드당 100자 이상 작성하세요");
  }

  // 불릿 3개 이하 체크
  const overBulletSlides = slides.filter(
    s => (s.content?.bullets?.length || 0) > 4
  ).length;
  if (overBulletSlides > 0) {
    scoreDensity = Math.max(scoreDensity - 3, 0);
    suggestions.push(`${overBulletSlides}개 슬라이드의 불릿이 4개를 초과합니다`);
  }
  details["text_density"] = `평균 ${Math.round(avgChars)}자/슬라이드, 불릿 초과 ${overBulletSlides}개`;

  // --- 2. 정량 데이터 (15점) ---
  const numberPattern = /\d[\d,.]*[조억만천]|[\d,.]+%|\$[\d,.]+[BMK]?|[₩\d,.]+원/g;
  let slidesWithNumbers = 0;
  for (const text of allText) {
    if (countMatches(text, numberPattern) > 0) slidesWithNumbers++;
  }
  const numberRatio = slidesWithNumbers / Math.max(slides.length, 1);
  let scoreNumeric = Math.round(numberRatio * 15);
  if (numberRatio < 0.5) {
    suggestions.push("슬라이드의 50% 이상에 정량 데이터를 포함하세요");
  }
  details["numeric_data"] = `${slidesWithNumbers}/${slides.length} 슬라이드에 숫자 포함 (${Math.round(numberRatio * 100)}%)`;

  // --- 3. 시각화 요소 (15점) ---
  let chartCount = 0;
  let statsCount = 0;
  for (const slide of slides) {
    if (slide.content?.chart) chartCount++;
    if (slide.content?.stats && slide.content.stats.length > 0) statsCount++;
  }
  const visualTotal = chartCount + statsCount;
  let scoreVisual = 0;
  if (visualTotal >= 5) scoreVisual = 15;
  else if (visualTotal >= 3) scoreVisual = 12;
  else if (visualTotal >= 1) scoreVisual = 8;
  else {
    scoreVisual = 3;
    suggestions.push("차트/그래프를 최소 3개 이상 포함하세요 (TAM/SAM/SOM, 매출추이, 자금사용 등)");
  }
  details["visual_elements"] = `차트 ${chartCount}개, 통계카드 ${statsCount}개`;

  // --- 4. 스토리 흐름 (15점) ---
  const slideTypes = slides.map(s => s.slide_type);
  let flowScore = 0;

  // 순서 일치도 체크 (Levenshtein 대신 간단한 순서 비교)
  const idealPresent = IDEAL_FLOW.filter(t => slideTypes.includes(t));
  const actualOrder = slideTypes.filter(t => IDEAL_FLOW.includes(t));

  let correctOrder = 0;
  for (let i = 0; i < actualOrder.length - 1; i++) {
    const idealIdx1 = IDEAL_FLOW.indexOf(actualOrder[i]);
    const idealIdx2 = IDEAL_FLOW.indexOf(actualOrder[i + 1]);
    if (idealIdx1 < idealIdx2) correctOrder++;
  }
  const orderRatio = correctOrder / Math.max(actualOrder.length - 1, 1);
  flowScore = Math.round(orderRatio * 10);

  // 필수 슬라이드 존재 체크 (+5점)
  const essentialTypes = ["problem", "solution", "market", "traction", "ask"];
  const hasEssential = essentialTypes.filter(t => slideTypes.includes(t)).length;
  flowScore += Math.round((hasEssential / essentialTypes.length) * 5);

  if (hasEssential < 4) {
    const missing = essentialTypes.filter(t => !slideTypes.includes(t));
    suggestions.push(`필수 슬라이드 누락: ${missing.join(", ")}`);
  }
  details["story_flow"] = `순서 일치 ${Math.round(orderRatio * 100)}%, 필수 슬라이드 ${hasEssential}/5`;

  // --- 5. 슬라이드 분량 (10점) ---
  let scoreCount = 0;
  const count = slides.length;
  if (count >= 10 && count <= 15) scoreCount = 10;
  else if (count >= 8 && count <= 18) scoreCount = 7;
  else if (count < 8) {
    scoreCount = 4;
    suggestions.push("슬라이드가 너무 적습니다 (10~15장 권장)");
  } else {
    scoreCount = 4;
    suggestions.push("슬라이드가 너무 많습니다 (15장 이내 권장)");
  }
  details["slide_count"] = `${count}장 (최적: 10~15장)`;

  // --- 6. 디자인 일관성 (10점) ---
  // (JSON 기반 채점이므로 텍스트 길이 편차로 대리 평가)
  const charLengths = allText.map(t => t.length);
  const mean = charLengths.reduce((a, b) => a + b, 0) / Math.max(charLengths.length, 1);
  const variance = charLengths.reduce((sum, len) => sum + (len - mean) ** 2, 0) / Math.max(charLengths.length, 1);
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 0; // 변동계수

  let scoreConsistency = 0;
  if (cv < 0.4) scoreConsistency = 10;
  else if (cv < 0.7) scoreConsistency = 7;
  else {
    scoreConsistency = 4;
    suggestions.push("슬라이드 간 텍스트 분량 편차가 큽니다. 균일하게 조정하세요");
  }
  details["consistency"] = `텍스트 변동계수 ${cv.toFixed(2)} (낮을수록 일관)`;

  // --- 7. 출처/근거 (10점) ---
  const sourcePatterns = [
    /출처|source|자료|기준|조사|통계|보고서|리서치/gi,
    /\d{4}년|\d{4}\)/g,
    /Gartner|McKinsey|Statista|IDC|Euromonitor|농림|산업부|중기부|한국|글로벌/gi,
  ];
  let sourceHits = 0;
  const fullText = allText.join(" ");
  for (const p of sourcePatterns) {
    sourceHits += countMatches(fullText, p);
  }
  let scoreSource = 0;
  if (sourceHits >= 6) scoreSource = 10;
  else if (sourceHits >= 3) scoreSource = 7;
  else if (sourceHits >= 1) scoreSource = 4;
  else {
    scoreSource = 1;
    suggestions.push("시장 데이터에 출처(기관명, 연도)를 표기하세요");
  }
  details["data_source"] = `출처/근거 키워드 ${sourceHits}개 발견`;

  // --- 8. 투자자 어필 (10점) ---
  const investorKeywords = [
    "투자", "밸류에이션", "valuation", "exit", "IPO", "M&A",
    "ROI", "수익률", "사용계획", "자금", "라운드", "시리즈",
    "Pre-A", "Series", "성장률", "CAGR", "MoM", "YoY",
  ];
  const investorHits = investorKeywords.filter(kw =>
    fullText.toLowerCase().includes(kw.toLowerCase())
  ).length;

  let scoreAppeal = 0;
  if (investorHits >= 8) scoreAppeal = 10;
  else if (investorHits >= 5) scoreAppeal = 7;
  else if (investorHits >= 2) scoreAppeal = 4;
  else {
    scoreAppeal = 1;
    suggestions.push("투자 금액, 밸류에이션, 자금사용계획을 명시하세요");
  }

  // Ask 슬라이드 존재 보너스
  const hasAsk = slideTypes.includes("ask");
  if (!hasAsk) {
    scoreAppeal = Math.max(scoreAppeal - 3, 0);
    suggestions.push("투자 요청(Ask) 슬라이드를 추가하세요");
  }
  details["investor_appeal"] = `투자 키워드 ${investorHits}개, Ask 슬라이드 ${hasAsk ? "있음" : "없음"}`;

  const total = scoreDensity + scoreNumeric + scoreVisual + flowScore +
    scoreCount + scoreConsistency + scoreSource + scoreAppeal;

  return {
    score_text_density: scoreDensity,
    score_numeric_data: scoreNumeric,
    score_visual_elements: scoreVisual,
    score_story_flow: flowScore,
    score_slide_count: scoreCount,
    score_consistency: scoreConsistency,
    score_data_source: scoreSource,
    score_investor_appeal: scoreAppeal,
    total_score: total,
    details,
    improvement_suggestions: suggestions,
  };
}

// ---------------------------------------------------------------------------
// scoreAndSavePpt – DB 저장
// ---------------------------------------------------------------------------

export async function scoreAndSavePpt(
  presentationId: string,
  slides: SlideInput[],
): Promise<PptScoreResult> {
  const result = autoScorePpt(slides);
  const supabase = createAdminClient();

  await supabase.from("ppt_quality_scores").upsert(
    {
      presentation_id: presentationId,
      ...result,
    },
    { onConflict: "presentation_id" },
  );

  // ir_presentations에도 점수 반영 (quality_score 컬럼이 있다면)
  // 없으면 무시 (에러 안 남)
  await supabase
    .from("ir_presentations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", presentationId);

  return { presentation_id: presentationId, ...result };
}

// ---------------------------------------------------------------------------
// scorePptByPresentationId – DB에서 슬라이드 로드 후 채점
// ---------------------------------------------------------------------------

export async function scorePptByPresentationId(
  presentationId: string,
): Promise<PptScoreResult> {
  const supabase = createAdminClient();
  const { data: slides } = await supabase
    .from("ir_slides")
    .select("slide_type, title, content, notes")
    .eq("presentation_id", presentationId)
    .order("slide_order", { ascending: true });

  if (!slides || slides.length === 0) {
    throw new Error("슬라이드가 없습니다");
  }

  return scoreAndSavePpt(presentationId, slides as SlideInput[]);
}
