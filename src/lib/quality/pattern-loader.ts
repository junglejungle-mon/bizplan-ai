/**
 * DB에서 선정패턴(winning_patterns)과 평가기준(evaluation_criteria)을 로드하여
 * 프롬프트에 주입할 수 있는 텍스트로 변환
 *
 * Redis 캐싱: Redis 사용 가능 시 분산 캐시, 불가 시 인메모리 자동 폴백
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { cache } from "@/lib/redis";

const CACHE_TTL = 300; // 5분 (초 단위, Redis EX용)

// ---------------------------------------------------------------------------
// loadWinningPatterns — DB에서 활성 선정패턴을 로드하여 프롬프트 텍스트로 변환
// ---------------------------------------------------------------------------
export async function loadWinningPatterns(): Promise<string> {
  return cache.getOrSet("patterns:winning", CACHE_TTL, async () => {
    const supabase = createAdminClient();
    const { data: patterns, error } = await supabase
      .from("winning_patterns")
      .select("title, description, good_examples, bad_examples, weight, category, subcategory")
      .eq("is_active", true)
      .order("weight", { ascending: false });

    if (error || !patterns || patterns.length === 0) {
      return "";
    }

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

    return lines.join("\n");
  });
}

// ---------------------------------------------------------------------------
// loadEvaluationCriteria — 특정 template_type에 맞는 평가기준 로드
// ---------------------------------------------------------------------------
export async function loadEvaluationCriteria(
  templateType: string,
): Promise<string> {
  return cache.getOrSet(`criteria:${templateType}`, CACHE_TTL, async () => {
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

    return lines.join("\n");
  });
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
export async function loadPptPatterns(): Promise<string> {
  return cache.getOrSet("patterns:ppt", CACHE_TTL, async () => {
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

    return lines.join("\n");
  });
}

// ---------------------------------------------------------------------------
// loadSlideReferences — 슬라이드 타입별 실제 선정 레퍼런스 로드 (Few-shot)
// ---------------------------------------------------------------------------
export async function loadSlideReferences(
  slideTypes?: string[],
  maxPerType: number = 2,
): Promise<string> {
  // Redis에는 JSON 직렬화 가능한 Record로 저장
  const grouped = await cache.getOrSet<Record<string, string[]>>(
    "patterns:slide_refs",
    CACHE_TTL,
    async () => {
      const supabase = createAdminClient();
      const { data: refs, error } = await supabase
        .from("slide_references")
        .select("slide_type, title, full_text, source_file, char_count")
        .eq("is_active", true)
        .order("char_count", { ascending: false });

      if (error || !refs || refs.length === 0) {
        return {};
      }

      // 타입별 그룹핑 (Record로 변환하여 JSON 직렬화 호환)
      const result: Record<string, string[]> = {};
      for (const r of refs) {
        if (!result[r.slide_type]) result[r.slide_type] = [];
        if (result[r.slide_type].length < 5) {
          const text = `[${r.source_file}] ${r.title}\n${r.full_text}`;
          result[r.slide_type].push(text);
        }
      }
      return result;
    },
  );

  // Record → Map 변환 후 포맷팅
  const groupedMap = new Map(Object.entries(grouped));
  return formatSlideRefs(groupedMap, slideTypes, maxPerType);
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
