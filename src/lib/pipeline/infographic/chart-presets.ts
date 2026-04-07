/**
 * 차트 프리셋 — pattern-library의 ChartType을 pptx-builder가 받는 형식으로 변환
 *
 * 핵심 역할:
 * 1. pattern-library의 추상 ChartType을 pptx-builder가 실제로 그릴 수 있는 차트 객체로 변환
 * 2. 각 섹션별 권장 차트의 "기본 데이터 스켈레톤" 제공 (Generator가 빈칸을 채움)
 * 3. 색상/스타일을 패턴 가이드와 일관되게 유지
 *
 * 사용:
 *   import { buildChartPreset } from './infographic/chart-presets';
 *   const chart = buildChartPreset('tam_sam_som', { tam: 695, sam: 34.7, som: 17.4, unit: '억$' });
 */
import { COLOR_PALETTE, type ChartType } from './pattern-library';

// ============================================================================
// 1. pptx-builder가 받는 차트 객체 형식
// ============================================================================

/**
 * pptx-builder의 addChartToSlide()가 받는 chart 객체 형식
 * (src/lib/pptx/pptx-builder.ts 의 ChartDataItem과 호환)
 */
export interface ChartPreset {
  type: string; // pptx-builder의 case 키 (bar, pie, tam_sam_som, ...)
  title?: string;
  data?: unknown; // 타입별로 다름
}

// ============================================================================
// 2. abstract ChartType → pptx-builder type 매핑
// ============================================================================

/**
 * pattern-library의 추상 ChartType → pptx-builder가 이해하는 case 문자열
 */
const CHART_TYPE_TO_BUILDER: Record<ChartType, string> = {
  line: 'line',
  bar: 'bar',
  horizontal_bar: 'bar', // 빌더가 가로 막대 별도 안 받으면 bar로
  pie: 'pie',
  donut: 'pie', // doughnut 폴백
  radar: 'bar', // pptxgenjs radar 안 쓰는 경우 bar 폴백
  tam_sam_som: 'tam_sam_som',
  treemap: 'bar', // treemap 미지원 시 bar 폴백
  gantt: 'timeline',
  timeline: 'timeline',
  flow: 'revenue_model', // 빌더의 플로우 표현
  positioning_map: 'comparison_table',
  org_tree: 'org_chart',
  highlight_cards: 'highlight_cards',
};

export function resolveBuilderChartType(abstract: ChartType): string {
  return CHART_TYPE_TO_BUILDER[abstract] || 'bar';
}

// ============================================================================
// 3. 차트별 데이터 스켈레톤 빌더
// ============================================================================

export interface TamSamSomInput {
  tam: number;
  sam: number;
  som: number;
  unit?: string; // "억원", "$", "억$"
  cagr?: string; // "8.3%"
}

export function buildTamSamSomPreset(input: TamSamSomInput, title = '시장 규모'): ChartPreset {
  const unit = input.unit || '억원';
  return {
    type: 'tam_sam_som',
    title,
    data: {
      tam: { value: `${input.tam}${unit}`, label: 'TAM (총 시장)' },
      sam: { value: `${input.sam}${unit}`, label: 'SAM (유효 시장)' },
      som: { value: `${input.som}${unit}`, label: 'SOM (목표 시장)' },
      ...(input.cagr ? { cagr: input.cagr } : {}),
    },
  };
}

export interface BarChartInput {
  /** 카테고리 라벨 (X축) */
  categories: string[];
  /** 시리즈 — name + 값 배열 */
  series: Array<{ name: string; values: number[] }>;
}

export function buildBarChartPreset(input: BarChartInput, title = '비교'): ChartPreset {
  return {
    type: 'bar',
    title,
    data: {
      categories: input.categories,
      series: input.series,
    },
  };
}

export interface LineChartInput {
  categories: string[]; // 시간축 (Q1, Q2, ...)
  series: Array<{ name: string; values: number[] }>;
}

export function buildLineChartPreset(input: LineChartInput, title = '추이'): ChartPreset {
  return {
    type: 'line',
    title,
    data: {
      categories: input.categories,
      series: input.series,
    },
  };
}

export interface PieChartInput {
  segments: Array<{ label: string; value: number }>;
}

export function buildPiePreset(input: PieChartInput, title = '구성'): ChartPreset {
  // 합 100% 검증 (경고용, 강제는 안 함)
  return {
    type: 'pie',
    title,
    data: {
      segments: input.segments,
    },
  };
}

export interface HighlightCardInput {
  cards: Array<{ icon?: string; value: string; label: string }>;
}

export function buildHighlightCardsPreset(
  input: HighlightCardInput,
  title?: string
): ChartPreset {
  return {
    type: 'highlight_cards',
    title,
    data: {
      items: input.cards,
    },
  };
}

export interface TimelineInput {
  events: Array<{
    date: string; // "Q1", "2024.03", "1단계"
    event: string; // 마일스톤 이름
    desc?: string;
  }>;
}

export function buildTimelinePreset(input: TimelineInput, title = '로드맵'): ChartPreset {
  return {
    type: 'timeline',
    title,
    data: {
      events: input.events,
    },
  };
}

export interface ComparisonTableInput {
  headers: string[]; // ["구분", "자사", "경쟁사 A", "경쟁사 B"]
  rows: string[][]; // [["가격", "8.5만원", "15만원", "12만원"], ...]
  highlightColumn?: number; // 자사 컬럼 인덱스 (강조)
}

export function buildComparisonTablePreset(
  input: ComparisonTableInput,
  title = '경쟁사 비교'
): ChartPreset {
  return {
    type: 'comparison_table',
    title,
    data: {
      headers: input.headers,
      rows: input.rows,
      ...(input.highlightColumn !== undefined ? { highlightColumn: input.highlightColumn } : {}),
    },
  };
}

// ============================================================================
// 4. 섹션별 빈 데이터 스켈레톤 (Generator가 채울 템플릿)
// ============================================================================

/**
 * 섹션 키 → 빈 차트 데이터 스켈레톤
 *
 * Generator AI에게 "이 모양으로 채워줘"라고 줄 수 있는 표준 형식.
 * 모든 값은 placeholder (Generator가 사업 정보로 교체).
 */
export const CHART_SKELETONS: Record<string, ChartPreset> = {
  market: buildTamSamSomPreset(
    { tam: 0, sam: 0, som: 0, unit: '억원', cagr: '__%' },
    '시장 규모 (TAM/SAM/SOM)'
  ),

  problem: buildHighlightCardsPreset(
    {
      cards: [
        { icon: '⚠', value: '__', label: '문제 1' },
        { icon: '📉', value: '__', label: '문제 2' },
        { icon: '⏱', value: '__', label: '문제 3' },
      ],
    },
    '시장의 3대 문제점'
  ),

  overview: buildHighlightCardsPreset(
    {
      cards: [
        { icon: '💰', value: '__', label: '매출' },
        { icon: '👥', value: '__', label: '고용' },
        { icon: '🌍', value: '__', label: '수출' },
      ],
    },
    '핵심 수치'
  ),

  competition: buildComparisonTablePreset(
    {
      headers: ['구분', '자사', '경쟁사 A', '경쟁사 B'],
      rows: [
        ['가격', '__', '__', '__'],
        ['품질', '__', '__', '__'],
        ['시장점유율', '__', '__', '__'],
        ['핵심 강점', '__', '__', '__'],
      ],
      highlightColumn: 1,
    },
    '경쟁사 비교'
  ),

  roadmap: buildTimelinePreset(
    {
      events: [
        { date: 'Q1', event: '시제품 개발', desc: '__' },
        { date: 'Q2', event: '양산 체제', desc: '__' },
        { date: 'Q3', event: '시장 진입', desc: '__' },
        { date: 'Q4', event: '매출 목표', desc: '__' },
      ],
    },
    '4분기 로드맵'
  ),

  financials: buildBarChartPreset(
    {
      categories: ['2024', '2025', '2026'],
      series: [{ name: '매출(억원)', values: [0, 0, 0] }],
    },
    '3년 매출 전망'
  ),

  business_model: {
    type: 'revenue_model',
    title: '비즈니스 모델',
    data: {
      flow: ['고객', '제품/서비스', '수익'],
      loops: ['마케팅', '판매', '반복구매'],
    },
  },

  team: {
    type: 'org_chart',
    title: '조직 구성',
    data: {
      ceo: '대표이사',
      branches: ['기술총괄', '마케팅', '운영'],
    },
  },

  traction: buildLineChartPreset(
    {
      categories: ['1월', '2월', '3월', '4월', '5월', '6월'],
      series: [{ name: '월 매출(백만원)', values: [0, 0, 0, 0, 0, 0] }],
    },
    '월별 성장 추이'
  ),

  ask: buildPiePreset(
    {
      segments: [
        { label: 'R&D', value: 0 },
        { label: '마케팅', value: 0 },
        { label: '운영', value: 0 },
      ],
    },
    '투자금 사용처'
  ),

  solution: buildHighlightCardsPreset(
    {
      cards: [
        { icon: '⚡', value: '__', label: '핵심 기능 1' },
        { icon: '🎯', value: '__', label: '핵심 기능 2' },
        { icon: '🛡', value: '__', label: '핵심 기능 3' },
      ],
    },
    '핵심 솔루션'
  ),
};

/**
 * 섹션 키로 빈 차트 스켈레톤 가져오기
 */
export function getSkeletonForSection(section: string): ChartPreset | null {
  return CHART_SKELETONS[section] || null;
}

/**
 * 추상 ChartType 1순위 + 컨텍스트 → 적절한 빈 스켈레톤
 */
export function buildPresetByAbstractType(
  abstract: ChartType,
  title?: string
): ChartPreset {
  switch (abstract) {
    case 'tam_sam_som':
      return buildTamSamSomPreset({ tam: 0, sam: 0, som: 0, unit: '억원' }, title);
    case 'highlight_cards':
      return buildHighlightCardsPreset(
        {
          cards: [
            { value: '__', label: '__' },
            { value: '__', label: '__' },
            { value: '__', label: '__' },
          ],
        },
        title
      );
    case 'timeline':
    case 'gantt':
      return buildTimelinePreset(
        {
          events: [
            { date: '__', event: '__' },
            { date: '__', event: '__' },
            { date: '__', event: '__' },
          ],
        },
        title || '타임라인'
      );
    case 'pie':
    case 'donut':
      return buildPiePreset(
        {
          segments: [
            { label: '__', value: 0 },
            { label: '__', value: 0 },
          ],
        },
        title
      );
    case 'line':
      return buildLineChartPreset(
        {
          categories: ['__', '__', '__'],
          series: [{ name: '__', values: [0, 0, 0] }],
        },
        title
      );
    case 'positioning_map':
      return buildComparisonTablePreset(
        {
          headers: ['구분', '자사', '경쟁사'],
          rows: [['가격', '__', '__']],
          highlightColumn: 1,
        },
        title || '포지셔닝'
      );
    case 'org_tree':
      return {
        type: 'org_chart',
        title: title || '조직도',
        data: { ceo: '__', branches: ['__', '__', '__'] },
      };
    case 'flow':
      return {
        type: 'revenue_model',
        title: title || '플로우',
        data: { flow: ['__', '__', '__'] },
      };
    case 'bar':
    case 'horizontal_bar':
    case 'radar':
    case 'treemap':
    default:
      return buildBarChartPreset(
        {
          categories: ['__', '__', '__'],
          series: [{ name: '__', values: [0, 0, 0] }],
        },
        title
      );
  }
}

/**
 * 색상 일관성 헬퍼 — 차트에 표준 색상 적용 (Generator/Renderer 양쪽 활용 가능)
 */
export function getDefaultChartColors(): {
  primary: string;
  secondary: string;
  accent: string;
  positive: string;
  negative: string;
} {
  return {
    primary: COLOR_PALETTE.base.primary,
    secondary: COLOR_PALETTE.base.secondary,
    accent: COLOR_PALETTE.base.accent,
    positive: COLOR_PALETTE.base.positive,
    negative: COLOR_PALETTE.base.negative,
  };
}
