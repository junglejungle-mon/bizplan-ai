/**
 * 패턴 셀렉터 — 슬라이드 컨텐츠/사업 정보를 분석해 최적 패턴 + 차트 추천
 *
 * 핵심 역할:
 * 1. ir-generator가 슬라이드를 만들 때 "이 섹션엔 어떤 차트?"를 결정
 * 2. ppt-harness가 약한 슬라이드를 개선할 때 "어떤 시각요소를 추가해야 점수가 오를까?"를 결정
 * 3. 데이터 키워드 자동 감지 (TAM/SAM/SOM, 매출, 분기, 비교 등)
 *
 * 사용:
 *   import { selectPatternForContent, recommendChartType } from './infographic/pattern-selector';
 *   const recommendation = selectPatternForContent({ slideType: 'market', text: '...' });
 */
import {
  getPatternForSlide,
  diagnoseSlideAgainstPattern,
  type ChartType,
  type InfographicPattern,
  type SlideWeakness,
} from './pattern-library';
import {
  buildPresetByAbstractType,
  getSkeletonForSection,
  resolveBuilderChartType,
  type ChartPreset,
} from './chart-presets';

// ============================================================================
// 1. 키워드 감지 (텍스트 → 데이터 유형)
// ============================================================================

/**
 * 데이터 패턴 키워드 — 슬라이드 텍스트에서 어떤 차트가 어울리는지 감지
 */
const DATA_PATTERN_KEYWORDS: Array<{
  pattern: ChartType;
  keywords: string[];
  /** 가중치 (높을수록 우선) */
  weight: number;
}> = [
  {
    pattern: 'tam_sam_som',
    keywords: ['TAM', 'SAM', 'SOM', '시장 규모', '시장규모', '글로벌 시장', '국내 시장'],
    weight: 10,
  },
  {
    pattern: 'line',
    keywords: [
      '성장률',
      'CAGR',
      '추이',
      '월별',
      '분기별',
      '연도별',
      '매출 추이',
      '성장 추이',
      '전년 대비',
    ],
    weight: 7,
  },
  {
    pattern: 'bar',
    keywords: ['연도별', '매출', '비교', '대비', '3년', '5년'],
    weight: 5,
  },
  {
    pattern: 'pie',
    keywords: ['배분', '비중', '구성', '점유율', '비율', '%'],
    weight: 6,
  },
  {
    pattern: 'horizontal_bar',
    keywords: ['경쟁사', '비교', '벤치마크', '순위'],
    weight: 6,
  },
  {
    pattern: 'positioning_map',
    keywords: ['포지셔닝', '맵', '2x2', '매트릭스', '품질-가격'],
    weight: 8,
  },
  {
    pattern: 'timeline',
    keywords: ['로드맵', '일정', '단계', 'Q1', 'Q2', 'Q3', 'Q4', '분기', '월'],
    weight: 8,
  },
  {
    pattern: 'gantt',
    keywords: ['간트', '일정표', '월별 계획'],
    weight: 7,
  },
  {
    pattern: 'flow',
    keywords: ['흐름', '플로우', '프로세스', '단계별', '여정', '퍼널'],
    weight: 7,
  },
  {
    pattern: 'org_tree',
    keywords: ['조직도', '대표', 'CEO', '본부', '팀원', '구성원'],
    weight: 9,
  },
  {
    pattern: 'highlight_cards',
    keywords: ['핵심', '주요', '3대', '4대', '주요 지표', 'KPI', '하이라이트'],
    weight: 5,
  },
  {
    pattern: 'treemap',
    keywords: ['세분화', '카테고리', '제품군', '서비스 분류'],
    weight: 6,
  },
  {
    pattern: 'radar',
    keywords: ['역량', '다축', '레이더', '종합 비교'],
    weight: 5,
  },
];

/**
 * 텍스트 → 차트 후보 + 점수
 */
export function detectChartCandidates(
  text: string
): Array<{ chartType: ChartType; score: number; matchedKeywords: string[] }> {
  if (!text) return [];
  const candidates: Array<{
    chartType: ChartType;
    score: number;
    matchedKeywords: string[];
  }> = [];

  for (const { pattern, keywords, weight } of DATA_PATTERN_KEYWORDS) {
    const matched = keywords.filter((kw) =>
      text.toLowerCase().includes(kw.toLowerCase())
    );
    if (matched.length > 0) {
      candidates.push({
        chartType: pattern,
        score: matched.length * weight,
        matchedKeywords: matched,
      });
    }
  }

  // 점수 내림차순
  return candidates.sort((a, b) => b.score - a.score);
}

// ============================================================================
// 2. 추천 결과 타입
// ============================================================================

export interface PatternRecommendation {
  /** 매칭된 패턴 (없으면 null) */
  pattern: InfographicPattern | null;
  /** 추천 차트 타입 (1순위) */
  primaryChartType: ChartType | null;
  /** 추천 차트 타입 (대안) */
  alternativeChartTypes: ChartType[];
  /** pptx-builder가 받을 차트 객체 (스켈레톤, Generator가 채워넣을 자리) */
  chartSkeleton: ChartPreset | null;
  /** pptx-builder의 type 키 (case 문자열) */
  builderChartType: string | null;
  /** 키워드 매칭 결과 */
  detectedFromText: Array<{
    chartType: ChartType;
    score: number;
    matchedKeywords: string[];
  }>;
  /** Generator 프롬프트에 사용할 가이드 */
  guidance: string;
}

// ============================================================================
// 3. 메인 셀렉터
// ============================================================================

export interface SelectInput {
  /** 슬라이드 타입 (overview, market, ...) */
  slideType: string;
  /** 슬라이드에 들어갈 텍스트/내용 (있으면 키워드 감지에 사용) */
  text?: string;
  /** 사업 분야 (산업별 팔레트 선택용) */
  industry?: string;
}

/**
 * 슬라이드 컨텐츠 → 최적 패턴 추천
 */
export function selectPatternForContent(input: SelectInput): PatternRecommendation {
  const pattern = getPatternForSlide(input.slideType);

  // 1. 텍스트에서 키워드 감지
  const detected = input.text ? detectChartCandidates(input.text) : [];

  // 2. 차트 타입 결정 우선순위
  //    a) 텍스트 키워드 1순위가 패턴의 권장 차트와 겹치면 그것
  //    b) 패턴의 1순위 차트
  //    c) 텍스트 키워드 1순위 (패턴 없을 때)
  let primary: ChartType | null = null;
  const alternatives: ChartType[] = [];

  if (pattern && detected.length > 0) {
    const overlap = detected.find((d) => pattern.recommendedCharts.includes(d.chartType));
    if (overlap) {
      primary = overlap.chartType;
      alternatives.push(...pattern.recommendedCharts.filter((c) => c !== primary));
    } else {
      primary = pattern.recommendedCharts[0];
      alternatives.push(...pattern.recommendedCharts.slice(1));
      // 텍스트에서 감지된 것도 alternative로
      alternatives.push(...detected.slice(0, 2).map((d) => d.chartType));
    }
  } else if (pattern) {
    primary = pattern.recommendedCharts[0] || null;
    alternatives.push(...pattern.recommendedCharts.slice(1));
  } else if (detected.length > 0) {
    primary = detected[0].chartType;
    alternatives.push(...detected.slice(1, 3).map((d) => d.chartType));
  }

  // 3. 차트 스켈레톤 빌드
  let skeleton: ChartPreset | null = null;
  if (pattern) {
    skeleton = getSkeletonForSection(pattern.section);
  }
  if (!skeleton && primary) {
    skeleton = buildPresetByAbstractType(primary);
  }

  // 4. pptx-builder type 결정
  const builderType = primary ? resolveBuilderChartType(primary) : null;

  // 5. 가이드 문장
  const guidance = buildSelectionGuidance(pattern, primary, detected);

  return {
    pattern,
    primaryChartType: primary,
    alternativeChartTypes: dedupe(alternatives),
    chartSkeleton: skeleton,
    builderChartType: builderType,
    detectedFromText: detected,
    guidance,
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildSelectionGuidance(
  pattern: InfographicPattern | null,
  primary: ChartType | null,
  detected: Array<{ chartType: ChartType; score: number; matchedKeywords: string[] }>
): string {
  const lines: string[] = [];

  if (pattern) {
    lines.push(`[${pattern.koreanName}] 섹션 최적 패턴 적용`);
    lines.push(`- 권장 시각: ${pattern.visualElements.slice(0, 2).join(', ')}`);
    lines.push(`- 레이아웃: ${pattern.layoutHint}`);
  } else {
    lines.push('[알 수 없는 섹션] 일반 가이드 적용');
  }

  if (primary) {
    lines.push(`- 1순위 차트: ${primary}`);
  }

  if (detected.length > 0) {
    const topMatch = detected[0];
    lines.push(
      `- 텍스트 분석: ${topMatch.matchedKeywords.slice(0, 3).join(', ')} 키워드 감지 → ${topMatch.chartType}`
    );
  }

  if (pattern) {
    lines.push(`- 핵심 원칙: ${pattern.generatorGuidance}`);
  }

  return lines.join('\n');
}

// ============================================================================
// 4. 약점 → 개선 액션 변환
// ============================================================================

export interface ImprovementAction {
  /** 어떤 필드를 추가/보강해야 하는지 */
  action:
    | 'add_headline'
    | 'add_subtext'
    | 'add_bullets'
    | 'add_stats'
    | 'add_chart'
    | 'add_numbers';
  /** 우선순위 (낮을수록 먼저) */
  priority: number;
  /** 사람 읽기 쉬운 설명 */
  description: string;
  /** 차트 추가 액션이면 추천 차트 스켈레톤 */
  suggestedChart?: ChartPreset;
}

/**
 * 슬라이드 약점 → 구체적 개선 액션 리스트
 *
 * ppt-harness의 improveWeakSlides()가 사용 가능
 */
export function weaknessToActions(
  slideType: string,
  weakness: SlideWeakness
): ImprovementAction[] {
  const actions: ImprovementAction[] = [];
  const pattern = getPatternForSlide(slideType);

  // 1. 누락 필드 채우기
  for (const field of weakness.missingFields) {
    if (field === 'headline') {
      actions.push({
        action: 'add_headline',
        priority: 1,
        description: '임팩트 있는 한 문장 헤드라인 추가',
      });
    }
    if (field === 'subtext') {
      actions.push({
        action: 'add_subtext',
        priority: 4,
        description: '보조 설명 1~2문장 추가',
      });
    }
    if (field === 'bullets') {
      const max = pattern?.bulletsCount.max || 5;
      const min = pattern?.bulletsCount.min || 3;
      actions.push({
        action: 'add_bullets',
        priority: 2,
        description: `구체적인 불릿 ${min}~${max}개 추가 (수치 포함)`,
      });
    }
    if (field === 'stats') {
      const max = pattern?.statsCount.max || 4;
      const min = pattern?.statsCount.min || 3;
      actions.push({
        action: 'add_stats',
        priority: 2,
        description: `핵심 수치 카드 ${min}~${max}개 추가 (아이콘+값+라벨)`,
      });
    }
    if (field === 'chart') {
      const sk = pattern ? getSkeletonForSection(pattern.section) : null;
      const fallback =
        sk ||
        (weakness.recommendedChartTypes[0]
          ? buildPresetByAbstractType(weakness.recommendedChartTypes[0])
          : undefined);
      actions.push({
        action: 'add_chart',
        priority: 3,
        description: `${weakness.recommendedChartTypes.slice(0, 2).join(' 또는 ')} 차트 추가`,
        suggestedChart: fallback,
      });
    }
  }

  // 2. 부족한 stats 카드 보강
  if (weakness.insufficientStats && !weakness.missingFields.includes('stats')) {
    const { current, recommended } = weakness.insufficientStats;
    actions.push({
      action: 'add_stats',
      priority: 2,
      description: `stats 카드 ${recommended.min - current}개 더 추가 (현재 ${current}개)`,
    });
  }

  // 3. 부족한 bullets 보강
  if (weakness.insufficientBullets && !weakness.missingFields.includes('bullets')) {
    const { current, recommended } = weakness.insufficientBullets;
    actions.push({
      action: 'add_bullets',
      priority: 2,
      description: `bullets ${recommended.min - current}개 더 추가 (현재 ${current}개)`,
    });
  }

  // 4. 숫자 없으면 가장 우선
  if (!weakness.hasNumbers) {
    actions.push({
      action: 'add_numbers',
      priority: 0,
      description:
        '구체적인 수치 (매출, %, 명, 억원, $) 최소 3개 추가 — 평가 점수의 핵심',
    });
  }

  return actions.sort((a, b) => a.priority - b.priority);
}

/**
 * 슬라이드 → 약점 진단 → 개선 액션 리스트 (one-shot)
 */
export function diagnoseAndPlan(slide: {
  slide_type: string;
  content: {
    headline?: string;
    subtext?: string;
    bullets?: string[];
    stats?: Array<{ value: string; label: string }>;
    chart?: { type: string; title?: string; data?: unknown };
  };
}): {
  weakness: SlideWeakness | null;
  actions: ImprovementAction[];
  recommendation: PatternRecommendation;
} {
  const weakness = diagnoseSlideAgainstPattern(slide);
  const recommendation = selectPatternForContent({
    slideType: slide.slide_type,
    text: JSON.stringify(slide.content),
  });
  const actions = weakness ? weaknessToActions(slide.slide_type, weakness) : [];

  return { weakness, actions, recommendation };
}
