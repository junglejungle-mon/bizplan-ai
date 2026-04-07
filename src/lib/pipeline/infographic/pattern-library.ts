/**
 * 인포그래픽 패턴 라이브러리
 *
 * 출처: NAS skills/16-business-plan-writer/patterns/infographic-guide.md
 *       (실제 선정된 사업계획서 12건 분석 기반)
 *
 * 목적:
 * - PPT 슬라이드 작성 시 섹션별 권장 시각 패턴 제공
 * - ppt-harness가 약한 슬라이드 개선 시 참고
 * - ir-generator가 처음 만들 때 가이드로 사용
 *
 * 사용법:
 *   import { getPatternForSlide, COLOR_PALETTE } from './infographic/pattern-library';
 *   const pattern = getPatternForSlide('market', { industry: 'IT' });
 */

// ============================================================================
// 1. 색상 팔레트
// ============================================================================

export const COLOR_PALETTE = {
  /** 기본 팔레트 — 파란색 계열 (신뢰감) */
  base: {
    primary: '#1e40af', // 딥블루
    secondary: '#3b82f6', // 블루
    accent: '#f59e0b', // 앰버/골드 (포인트)
    background: '#f8fafc', // 라이트그레이
    text: '#1e293b', // 다크
    positive: '#22c55e', // 그린 (성장/긍정)
    negative: '#ef4444', // 레드 (위험/부정)
    neutral: '#94a3b8', // 그레이
  },
} as const;

/** 분야별 추천 색상 */
export const INDUSTRY_PALETTES = {
  IT: { primary: '#6366f1', secondary: '#8b5cf6' }, // 인디고 + 바이올렛
  AI: { primary: '#6366f1', secondary: '#8b5cf6' },
  bio: { primary: '#059669', secondary: '#0ea5e9' }, // 에메랄드 + 스카이
  manufacturing: { primary: '#1e40af', secondary: '#475569' }, // 블루 + 슬레이트
  esg: { primary: '#16a34a', secondary: '#84cc16' }, // 그린 + 라임
  environment: { primary: '#16a34a', secondary: '#84cc16' },
  export: { primary: '#dc2626', secondary: '#1e40af' }, // 레드 + 블루 (글로벌)
  default: { primary: '#1e40af', secondary: '#3b82f6' },
} as const;

export type IndustryKey = keyof typeof INDUSTRY_PALETTES;

/** 분야명을 팔레트 키로 매핑 */
export function resolveIndustryPalette(industry?: string): {
  primary: string;
  secondary: string;
} {
  if (!industry) return INDUSTRY_PALETTES.default;
  const key = industry.toLowerCase();
  if (key.includes('it') || key.includes('소프트') || key.includes('ai')) return INDUSTRY_PALETTES.IT;
  if (key.includes('바이오') || key.includes('의료')) return INDUSTRY_PALETTES.bio;
  if (key.includes('제조') || key.includes('공정')) return INDUSTRY_PALETTES.manufacturing;
  if (key.includes('환경') || key.includes('esg')) return INDUSTRY_PALETTES.esg;
  if (key.includes('수출') || key.includes('글로벌')) return INDUSTRY_PALETTES.export;
  return INDUSTRY_PALETTES.default;
}

// ============================================================================
// 2. 차트 매핑 규칙 (데이터 유형 → 차트 유형)
// ============================================================================

export type ChartType =
  | 'line' // 시간 추이
  | 'bar' // 비교/막대
  | 'horizontal_bar' // 가로 막대 (긴 라벨)
  | 'pie' // 비율
  | 'donut' // 비율 (중앙 텍스트)
  | 'radar' // 다축 비교
  | 'tam_sam_som' // 동심원 (TAM/SAM/SOM 전용)
  | 'treemap' // 시장 세분화
  | 'gantt' // 일정/단계
  | 'timeline' // 단순 타임라인
  | 'flow' // 플로우차트
  | 'positioning_map' // 2x2 매트릭스
  | 'org_tree' // 조직도
  | 'highlight_cards'; // 수치 카드

export const CHART_RULES: Array<{
  dataType: string;
  charts: ChartType[];
  examples: string[];
}> = [
  {
    dataType: 'time_series',
    charts: ['line', 'bar'],
    examples: ['매출 추이', '성장률', '월별 사용자 수'],
  },
  {
    dataType: 'composition',
    charts: ['pie', 'donut'],
    examples: ['사업비 배분', '매출 비중', '시장 점유율'],
  },
  {
    dataType: 'comparison',
    charts: ['horizontal_bar', 'radar'],
    examples: ['경쟁사 비교', '기술 비교', '가격 비교'],
  },
  {
    dataType: 'hierarchy',
    charts: ['tam_sam_som', 'treemap'],
    examples: ['TAM/SAM/SOM', '시장 세분화', '제품 카테고리'],
  },
  {
    dataType: 'schedule',
    charts: ['timeline', 'gantt'],
    examples: ['로드맵', '개발 일정', '마일스톤'],
  },
  {
    dataType: 'flow',
    charts: ['flow'],
    examples: ['BM 흐름', '고객 여정', '공정 흐름'],
  },
];

/** 차트 스타일 규칙 (디자인 원칙) */
export const CHART_STYLE_RULES = {
  maxColors: 5, // 색상 5개 초과 금지
  legendPosition: 'inside' as const, // 범례는 차트 안
  showDataLabels: true, // 숫자 라벨 필수
  requireTitle: true, // 제목 필수
  requireSubtitle: false, // 부제목 권장
  requireSource: true, // 출처 표시 필수
  gridLine: 'subtle' as const, // 옅은 회색
  forbidden3D: true, // 3D 절대 금지
} as const;

// ============================================================================
// 3. 슬라이드 패턴 (8개 섹션)
// ============================================================================

export type SlideSection =
  | 'overview' // 아이템 개요
  | 'problem' // 문제 인식
  | 'market' // 시장 분석
  | 'competition' // 경쟁사 분석
  | 'roadmap' // 로드맵
  | 'business_model' // 비즈니스 모델
  | 'financials' // 재무 계획
  | 'team' // 팀 구성
  | 'solution' // 솔루션 (보너스)
  | 'traction' // 성과 (보너스)
  | 'ask'; // 투자 요청 (보너스)

export interface InfographicPattern {
  /** 섹션 키 */
  section: SlideSection;
  /** 한글 이름 */
  koreanName: string;
  /** 권장 시각 요소 (슬라이드에 반드시 포함) */
  visualElements: string[];
  /** 권장 차트 유형 (1순위 → 2순위) */
  recommendedCharts: ChartType[];
  /** 레이아웃 설명 (Generator에게 줄 힌트) */
  layoutHint: string;
  /** 필수 구성 요소 (없으면 약한 슬라이드로 분류) */
  requiredFields: Array<'headline' | 'bullets' | 'stats' | 'chart' | 'subtext'>;
  /** 권장 stats 카드 개수 */
  statsCount: { min: number; max: number };
  /** 권장 bullets 개수 */
  bulletsCount: { min: number; max: number };
  /** Generator 프롬프트에 포함할 가이드 문장 */
  generatorGuidance: string;
}

export const SLIDE_PATTERNS: Record<SlideSection, InfographicPattern> = {
  overview: {
    section: 'overview',
    koreanName: '아이템 개요',
    visualElements: [
      '핵심 수치 카드 3~4개 (아이콘 + 숫자 + 라벨)',
      '제품/서비스 이미지 또는 스크린샷',
      '한눈에 보는 비즈니스 플로우 (3~5단계)',
    ],
    recommendedCharts: ['highlight_cards', 'flow'],
    layoutHint:
      '상단에 아이템명, 중간에 3열 수치 카드(매출/고용/수출), 하단에 제품 이미지 또는 플로우',
    requiredFields: ['headline', 'subtext', 'stats'],
    statsCount: { min: 3, max: 4 },
    bulletsCount: { min: 0, max: 3 },
    generatorGuidance:
      '평가위원이 30초 안에 사업의 본질을 이해할 수 있게 핵심 수치 3~4개를 카드 형태로 제시. 매출/고용/수출/특허 같은 임팩트 있는 수치 우선.',
  },

  problem: {
    section: 'problem',
    koreanName: '문제 인식',
    visualElements: [
      '시장 현황 통계 하이라이트 (볼드 숫자 3개)',
      'Before/After 비교 다이어그램',
      '문제의 심각성을 보여주는 차트',
    ],
    recommendedCharts: ['highlight_cards', 'bar', 'line'],
    layoutHint:
      '상단 헤드라인 (문제 한 문장), 중간 3개 통계 카드 (15조원/12만톤/40% 같은 충격 수치), 하단 Before/After 또는 추세 차트',
    requiredFields: ['headline', 'bullets', 'stats'],
    statsCount: { min: 3, max: 3 },
    bulletsCount: { min: 3, max: 5 },
    generatorGuidance:
      '시장의 3대 문제점을 정량 수치로 제시. "많은 사람이 불편" 같은 추상 표현 금지. "연 15조원 손실", "40% 에너지 낭비" 같은 충격 통계 필수.',
  },

  market: {
    section: 'market',
    koreanName: '시장 분석',
    visualElements: [
      'TAM/SAM/SOM 동심원 차트',
      '시장 성장률 추이 그래프',
      '시장 세분화 트리맵',
    ],
    recommendedCharts: ['tam_sam_som', 'line', 'treemap'],
    layoutHint:
      '좌측 TAM/SAM/SOM 동심원 (TAM=695억$, SAM=34.7억$, SOM=1740만$ 형식), 우측 CAGR 성장률 선그래프',
    requiredFields: ['headline', 'stats', 'chart'],
    statsCount: { min: 3, max: 3 },
    bulletsCount: { min: 0, max: 3 },
    generatorGuidance:
      'TAM/SAM/SOM 3개 수치는 무조건 포함. 모든 수치에 단위(억원, $, %) 명시. CAGR 같은 성장률 동봉. 출처 표기 권장.',
  },

  competition: {
    section: 'competition',
    koreanName: '경쟁사 분석',
    visualElements: [
      '경쟁사 비교 테이블 (5~7개 항목)',
      '포지셔닝 맵 (2x2 매트릭스)',
      '자사 차별점 하이라이트',
    ],
    recommendedCharts: ['horizontal_bar', 'radar', 'positioning_map'],
    layoutHint:
      '상단에 경쟁사 비교 표(가격/품질/시장점유율/기술), 또는 2x2 포지셔닝 맵에 자사+경쟁사 ★ 표시',
    requiredFields: ['headline', 'bullets', 'chart'],
    statsCount: { min: 0, max: 4 },
    bulletsCount: { min: 3, max: 5 },
    generatorGuidance:
      '자사 vs 경쟁사 A vs 경쟁사 B 형태로 비교. 자사가 우위인 항목 강조. 차별점은 정성이 아니라 정량으로(8.5만원 vs 15만원).',
  },

  roadmap: {
    section: 'roadmap',
    koreanName: '로드맵',
    visualElements: [
      '타임라인 다이어그램 (화살표 연결)',
      '간트차트 (월별/분기별)',
      '마일스톤 아이콘',
    ],
    recommendedCharts: ['timeline', 'gantt'],
    layoutHint:
      'Q1 → Q2 → Q3 → Q4 가로 타임라인, 각 분기별 마일스톤(시제품/양산/시장진입/매출목표)',
    requiredFields: ['headline', 'bullets', 'chart'],
    statsCount: { min: 0, max: 4 },
    bulletsCount: { min: 4, max: 6 },
    generatorGuidance:
      '단기/중기/장기 구분. 각 마일스톤에 구체 수치 목표 (1분기: 시제품 + 특허 1건, 2분기: 양산 + 인력 5명).',
  },

  business_model: {
    section: 'business_model',
    koreanName: '비즈니스 모델',
    visualElements: [
      '수익 모델 플로우차트',
      '가격 구조 테이블',
      '고객 획득 퍼널',
    ],
    recommendedCharts: ['flow', 'pie', 'horizontal_bar'],
    layoutHint:
      '[고객] → [제품/서비스] → [수익] 가로 플로우, 하단에 마케팅 → 판매 → 반복구매 루프',
    requiredFields: ['headline', 'bullets', 'chart'],
    statsCount: { min: 0, max: 4 },
    bulletsCount: { min: 3, max: 5 },
    generatorGuidance:
      '수익 발생 메커니즘을 화살표로 시각화. ARPU, LTV, CAC 같은 단위 경제 지표 권장. B2B/B2C 구분 명시.',
  },

  financials: {
    section: 'financials',
    koreanName: '재무 계획',
    visualElements: [
      '매출/이익 추이 막대 차트',
      '손익분기점 차트',
      '사업비 배분 파이 차트',
    ],
    recommendedCharts: ['bar', 'pie', 'line'],
    layoutHint:
      '좌측 3년 매출 추이 막대(24:30억, 25:80억, 26:200억), 우측 사업비 배분 파이(인건비40/개발30/마케팅20/기타10)',
    requiredFields: ['headline', 'stats', 'chart'],
    statsCount: { min: 3, max: 4 },
    bulletsCount: { min: 0, max: 3 },
    generatorGuidance:
      '3년 매출 목표(현실적 + 상승) 필수. 사업비 배분은 합 100%. 손익분기점 시점 명시. 모든 수치에 "억원" 같은 단위.',
  },

  team: {
    section: 'team',
    koreanName: '팀 구성',
    visualElements: [
      '조직도 (트리 구조)',
      '핵심 멤버 프로필 카드',
      '역량 레이더 차트 (선택)',
    ],
    recommendedCharts: ['org_tree', 'radar'],
    layoutHint:
      '상단에 대표이사, 그 아래 기술/마케팅/운영 본부, 각 본부 아래 팀원. 핵심 멤버는 학력+경력+성과 1줄.',
    requiredFields: ['headline', 'bullets'],
    statsCount: { min: 0, max: 3 },
    bulletsCount: { min: 3, max: 6 },
    generatorGuidance:
      '대표/핵심 멤버 학력+경력+해당 사업과의 연관성 명시. "○○대 석사, ○○사 R&D 15년, 특허 4건" 형식.',
  },

  // 보너스 패턴 (피치덱 / IR 추가 슬라이드)
  solution: {
    section: 'solution',
    koreanName: '솔루션',
    visualElements: [
      '제품/서비스 핵심 기능 3~4개',
      '기술 차별성 다이어그램',
      '특허/IP 카드',
    ],
    recommendedCharts: ['highlight_cards', 'flow'],
    layoutHint:
      '상단 헤드라인(우리는 ○○을 ○○로 해결), 중간 핵심 기능 3개 카드, 하단 기술 차별점',
    requiredFields: ['headline', 'subtext', 'bullets'],
    statsCount: { min: 0, max: 3 },
    bulletsCount: { min: 3, max: 5 },
    generatorGuidance:
      '문제 → 솔루션 매핑이 명확해야 함. 기술 차별점은 정량(3배 빠름, 50% 절감).',
  },

  traction: {
    section: 'traction',
    koreanName: '성과/Traction',
    visualElements: [
      '월별 매출/사용자 추이 막대 차트',
      '핵심 KPI 카드',
      '주요 고객사 로고',
    ],
    recommendedCharts: ['bar', 'line', 'highlight_cards'],
    layoutHint:
      '상단 핵심 KPI 3개 카드(MAU, 매출, 성장률), 중간 월별 추이 차트, 하단 고객사/파트너 로고',
    requiredFields: ['headline', 'stats', 'chart'],
    statsCount: { min: 3, max: 4 },
    bulletsCount: { min: 0, max: 3 },
    generatorGuidance:
      '실제 숫자로만 구성. "전년 대비 275% 성장(8억 → 30억)" 같은 비교 형식. KPI는 MoM 또는 YoY 표시.',
  },

  ask: {
    section: 'ask',
    koreanName: '투자 요청 (Ask)',
    visualElements: [
      '투자 금액 + 사용처 파이 차트',
      '예상 가치 카드',
      '주요 마일스톤 박스',
    ],
    recommendedCharts: ['pie', 'highlight_cards'],
    layoutHint:
      '좌측 투자 금액과 사용처 파이(R&D/마케팅/운영), 우측 18개월 후 마일스톤(매출100억/사용자100만)',
    requiredFields: ['headline', 'stats', 'chart'],
    statsCount: { min: 2, max: 4 },
    bulletsCount: { min: 0, max: 4 },
    generatorGuidance:
      '요청 금액 + 사용처 + 기대 결과(KPI)를 한 슬라이드에 모두. 사용처 합 100%. 결과는 "12개월 후 ○○ 달성" 형식.',
  },
};

// ============================================================================
// 4. Lookup 헬퍼
// ============================================================================

/**
 * 슬라이드 타입 → 패턴 가져오기
 * (slide_type 문자열이 다양할 수 있어서 매핑 제공)
 */
export function getPatternForSlide(
  slideType: string
): InfographicPattern | null {
  const normalized = slideType.toLowerCase().replace(/[-_\s]/g, '');

  // 직접 매칭
  if ((SLIDE_PATTERNS as Record<string, InfographicPattern>)[normalized]) {
    return SLIDE_PATTERNS[normalized as SlideSection];
  }

  // 별칭 매칭
  const aliases: Record<string, SlideSection> = {
    cover: 'overview',
    title: 'overview',
    summary: 'overview',
    intro: 'overview',
    problemstatement: 'problem',
    pain: 'problem',
    marketsize: 'market',
    market: 'market',
    tam: 'market',
    competitor: 'competition',
    competitors: 'competition',
    competitiveanalysis: 'competition',
    timeline: 'roadmap',
    plan: 'roadmap',
    schedule: 'roadmap',
    bm: 'business_model',
    businessmodel: 'business_model',
    revenue: 'business_model',
    finance: 'financials',
    financial: 'financials',
    forecast: 'financials',
    organization: 'team',
    members: 'team',
    product: 'solution',
    service: 'solution',
    feature: 'solution',
    metrics: 'traction',
    growth: 'traction',
    kpi: 'traction',
    investment: 'ask',
    funding: 'ask',
    use: 'ask',
  };

  if (aliases[normalized]) {
    return SLIDE_PATTERNS[aliases[normalized]];
  }

  return null;
}

/**
 * 슬라이드의 약점 진단 (패턴 대비 누락 요소 식별)
 *
 * @returns 누락된 필드 + 권장 차트 + 부족한 통계 카드 수
 */
export interface SlideWeakness {
  missingFields: string[];
  missingChart: boolean;
  recommendedChartTypes: ChartType[];
  insufficientStats: { current: number; recommended: { min: number; max: number } } | null;
  insufficientBullets: { current: number; recommended: { min: number; max: number } } | null;
  hasNumbers: boolean;
}

export function diagnoseSlideAgainstPattern(
  slide: {
    slide_type: string;
    content: {
      headline?: string;
      subtext?: string;
      bullets?: string[];
      stats?: Array<{ value: string; label: string }>;
      chart?: { type: string; title?: string; data?: unknown };
    };
  }
): SlideWeakness | null {
  const pattern = getPatternForSlide(slide.slide_type);
  if (!pattern) return null;

  const missingFields: string[] = [];
  const c = slide.content || {};

  for (const field of pattern.requiredFields) {
    if (field === 'headline' && !c.headline) missingFields.push('headline');
    if (field === 'subtext' && !c.subtext) missingFields.push('subtext');
    if (field === 'bullets' && (!c.bullets || c.bullets.length === 0))
      missingFields.push('bullets');
    if (field === 'stats' && (!c.stats || c.stats.length === 0))
      missingFields.push('stats');
    if (field === 'chart' && !c.chart) missingFields.push('chart');
  }

  const statsCount = c.stats?.length || 0;
  const bulletsCount = c.bullets?.length || 0;

  const insufficientStats =
    statsCount < pattern.statsCount.min
      ? { current: statsCount, recommended: pattern.statsCount }
      : null;

  const insufficientBullets =
    bulletsCount < pattern.bulletsCount.min
      ? { current: bulletsCount, recommended: pattern.bulletsCount }
      : null;

  const allText = JSON.stringify(c);
  const hasNumbers = /\d/.test(allText);

  return {
    missingFields,
    missingChart: !c.chart,
    recommendedChartTypes: pattern.recommendedCharts,
    insufficientStats,
    insufficientBullets,
    hasNumbers,
  };
}

/**
 * Generator를 위한 패턴 기반 가이드 문장 생성
 *
 * (improveWeakSlides 같은 함수에서 프롬프트에 끼워 넣을 용도)
 */
export function buildPatternGuidance(slideType: string): string {
  const pattern = getPatternForSlide(slideType);
  if (!pattern) {
    return '구체적 수치, 임팩트 있는 헤드라인, 시각 요소(차트/카드) 1개 이상 포함.';
  }

  const lines = [
    `[${pattern.koreanName}] 패턴 가이드:`,
    `- 권장 시각 요소: ${pattern.visualElements.join(', ')}`,
    `- 권장 차트: ${pattern.recommendedCharts.slice(0, 2).join(' 또는 ')}`,
    `- 레이아웃: ${pattern.layoutHint}`,
    `- 필수 필드: ${pattern.requiredFields.join(', ')}`,
    `- stats 카드: ${pattern.statsCount.min}~${pattern.statsCount.max}개`,
    `- bullets: ${pattern.bulletsCount.min}~${pattern.bulletsCount.max}개`,
    `- 핵심: ${pattern.generatorGuidance}`,
  ];

  return lines.join('\n');
}

/**
 * 모든 패턴 목록 (디버그/문서용)
 */
export function listAllPatterns(): InfographicPattern[] {
  return Object.values(SLIDE_PATTERNS);
}
