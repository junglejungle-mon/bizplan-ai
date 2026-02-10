/**
 * DB에서 선정패턴(winning_patterns)과 평가기준(evaluation_criteria)을 로드하여
 * 프롬프트에 주입할 수 있는 텍스트로 변환
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ---------------------------------------------------------------------------
// 캐시 (서버 프로세스 내 메모리 캐시, 5분 TTL)
// ---------------------------------------------------------------------------
let patternCache: { data: string; loadedAt: number } | null = null;
let criteriaCache: Map<string, { data: string; loadedAt: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5분

// ---------------------------------------------------------------------------
// loadWinningPatterns — DB에서 활성 선정패턴을 로드하여 프롬프트 텍스트로 변환
// ---------------------------------------------------------------------------
export async function loadWinningPatterns(): Promise<string> {
  // 캐시 확인
  if (patternCache && Date.now() - patternCache.loadedAt < CACHE_TTL) {
    return patternCache.data;
  }

  const supabase = createAdminClient();
  const { data: patterns, error } = await supabase
    .from("winning_patterns")
    .select("title, description, good_examples, bad_examples, weight, category, subcategory")
    .eq("is_active", true)
    .order("weight", { ascending: false });

  if (error || !patterns || patterns.length === 0) {
    // DB 실패 시 빈 문자열 (하드코딩 폴백은 writing.ts에 이미 있음)
    return "";
  }

  // 프롬프트 텍스트로 변환
  const lines: string[] = [
    "# 선정 사업계획서 필수 패턴 (DB 기반, 실제 선정 12건 분석)",
  ];

  for (let i = 0; i < patterns.length; i++) {
    const p = patterns[i];
    lines.push(`${i + 1}. **${p.title}** (${p.weight}점)`);
    if (p.description) lines.push(`   ${p.description}`);
    if (p.good_examples?.length > 0) {
      lines.push(`   ✅ ${p.good_examples[0]}`);
    }
    if (p.bad_examples?.length > 0) {
      lines.push(`   ❌ ${p.bad_examples[0]}`);
    }
  }

  const result = lines.join("\n");
  patternCache = { data: result, loadedAt: Date.now() };
  return result;
}

// ---------------------------------------------------------------------------
// loadEvaluationCriteria — 특정 template_type에 맞는 평가기준 로드
// ---------------------------------------------------------------------------
export async function loadEvaluationCriteria(
  templateType: string,
): Promise<string> {
  // 캐시 확인
  const cached = criteriaCache.get(templateType);
  if (cached && Date.now() - cached.loadedAt < CACHE_TTL) {
    return cached.data;
  }

  const supabase = createAdminClient();
  const { data: criteria, error } = await supabase
    .from("evaluation_criteria")
    .select("section_name, score_weight, criteria, high_score_strategy")
    .eq("template_type", templateType)
    .order("section_order", { ascending: true });

  if (error || !criteria || criteria.length === 0) {
    return "";
  }

  const lines: string[] = [
    `# 평가 기준 (${templateType} 유형)`,
  ];

  for (const c of criteria) {
    lines.push(`## ${c.section_name} (${c.score_weight}점)`);
    if (c.criteria && Array.isArray(c.criteria)) {
      for (const item of c.criteria) {
        lines.push(`- ${item}`);
      }
    }
    if (c.high_score_strategy) {
      lines.push(`💡 고득점 전략: ${c.high_score_strategy}`);
    }
  }

  const result = lines.join("\n");
  criteriaCache.set(templateType, { data: result, loadedAt: Date.now() });
  return result;
}

// ---------------------------------------------------------------------------
// buildDynamicSystemPrompt — 기존 SECTION_WRITER_SYSTEM에 DB 패턴을 추가
// ---------------------------------------------------------------------------
export async function buildDynamicWriterContext(
  templateType?: string,
): Promise<string> {
  const [patterns, criteria] = await Promise.all([
    loadWinningPatterns(),
    templateType ? loadEvaluationCriteria(templateType) : Promise.resolve(""),
  ]);

  const parts: string[] = [];
  if (patterns) parts.push(patterns);
  if (criteria) parts.push(criteria);

  return parts.join("\n\n");
}

// ---------------------------------------------------------------------------
// PPT 전용: loadPptPatterns — category가 'ppt_*'인 패턴만 로드
// ---------------------------------------------------------------------------
let pptPatternCache: { data: string; loadedAt: number } | null = null;

export async function loadPptPatterns(): Promise<string> {
  if (pptPatternCache && Date.now() - pptPatternCache.loadedAt < CACHE_TTL) {
    return pptPatternCache.data;
  }

  const supabase = createAdminClient();
  const { data: patterns, error } = await supabase
    .from("winning_patterns")
    .select("title, description, good_examples, bad_examples, weight, category, subcategory")
    .eq("is_active", true)
    .like("category", "ppt_%")
    .order("weight", { ascending: false });

  if (error || !patterns || patterns.length === 0) {
    return "";
  }

  const lines: string[] = [
    "# IR PPT 필수 패턴 (DB 기반, NAS 실제 선정 PPT + SKILL.md 분석)",
  ];

  // 카테고리별 그룹핑
  const groups = new Map<string, typeof patterns>();
  for (const p of patterns) {
    const group = groups.get(p.category) || [];
    group.push(p);
    groups.set(p.category, group);
  }

  const categoryLabels: Record<string, string> = {
    ppt_structure: "구조 패턴",
    ppt_content: "콘텐츠 패턴",
    ppt_design: "디자인 패턴",
    ppt_slide_type: "슬라이드별 패턴",
  };

  for (const [cat, items] of groups) {
    lines.push(`\n## ${categoryLabels[cat] || cat}`);
    for (const p of items) {
      lines.push(`- **${p.title}** (${p.weight}점): ${p.description}`);
      if (p.good_examples?.length > 0) {
        lines.push(`  ✅ ${p.good_examples[0]}`);
      }
      if (p.bad_examples?.length > 0) {
        lines.push(`  ❌ ${p.bad_examples[0]}`);
      }
    }
  }

  const result = lines.join("\n");
  pptPatternCache = { data: result, loadedAt: Date.now() };
  return result;
}

// ---------------------------------------------------------------------------
// loadSlideReferences — 슬라이드 타입별 실제 선정 레퍼런스 로드 (Few-shot)
// ---------------------------------------------------------------------------
let slideRefCache: { data: Map<string, string[]>; loadedAt: number } | null = null;

export async function loadSlideReferences(
  slideTypes?: string[],
  maxPerType: number = 2,
): Promise<string> {
  // 캐시 확인
  if (slideRefCache && Date.now() - slideRefCache.loadedAt < CACHE_TTL) {
    return formatSlideRefs(slideRefCache.data, slideTypes, maxPerType);
  }

  const supabase = createAdminClient();
  const { data: refs, error } = await supabase
    .from("slide_references")
    .select("slide_type, title, full_text, source_file, char_count")
    .eq("is_active", true)
    .order("char_count", { ascending: false }); // 내용이 풍부한 것 우선

  if (error || !refs || refs.length === 0) {
    return "";
  }

  // 타입별 그룹핑
  const grouped = new Map<string, string[]>();
  for (const r of refs) {
    const existing = grouped.get(r.slide_type) || [];
    // 타입당 최대 5개만 캐시
    if (existing.length < 5) {
      const text = `[${r.source_file}] ${r.title}\n${r.full_text}`;
      existing.push(text);
    }
    grouped.set(r.slide_type, existing);
  }

  slideRefCache = { data: grouped, loadedAt: Date.now() };
  return formatSlideRefs(grouped, slideTypes, maxPerType);
}

function formatSlideRefs(
  grouped: Map<string, string[]>,
  slideTypes?: string[],
  maxPerType: number = 2,
): string {
  const types = slideTypes || Array.from(grouped.keys());
  const lines: string[] = [
    "# 실제 선정된 PPT 슬라이드 레퍼런스 (Few-shot 학습용)",
    "아래는 실제 정부지원사업에서 선정된 PPT의 슬라이드입니다. 이 수준의 품질과 구조를 참고하세요.",
  ];

  for (const t of types) {
    const refs = grouped.get(t);
    if (!refs || refs.length === 0) continue;

    const typeLabel: Record<string, string> = {
      problem: "문제 정의", solution: "솔루션", market: "시장 규모",
      traction: "트랙션/성과", team: "팀 소개", tech: "기술/제품",
      competition: "경쟁 분석", financials: "재무 계획", roadmap: "로드맵",
      ask: "투자 요청", business_model: "비즈니스 모델", cover: "표지",
    };

    lines.push(`\n## ${typeLabel[t] || t} 슬라이드 레퍼런스`);
    for (let i = 0; i < Math.min(refs.length, maxPerType); i++) {
      lines.push(`### 예시 ${i + 1}`);
      lines.push(refs[i].substring(0, 500)); // 최대 500자
    }
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// buildDynamicIRContext — IR PPT 생성 프롬프트에 주입할 컨텍스트
// (패턴 + 평가기준 + Few-shot 레퍼런스)
// ---------------------------------------------------------------------------
export async function buildDynamicIRContext(): Promise<string> {
  const [pptPatterns, criteria, slideRefs] = await Promise.all([
    loadPptPatterns(),
    loadEvaluationCriteria("ir_pitch"),
    loadSlideReferences(undefined, 2), // 타입당 2개씩
  ]);

  const parts: string[] = [];
  if (pptPatterns) parts.push(pptPatterns);
  if (criteria) parts.push(criteria);
  if (slideRefs) parts.push(slideRefs);

  return parts.join("\n\n");
}
