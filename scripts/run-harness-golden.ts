#!/usr/bin/env npx tsx
/**
 * PPT 하네스 모듈 회귀 테스트
 *
 * 검증 대상:
 * 1. pattern-library: 11개 패턴 + 별칭 매칭
 * 2. chart-presets: 빌더 차트 매핑 + 스켈레톤
 * 3. pattern-selector: 키워드 감지 + 진단 + 액션 우선순위
 * 4. ppt-harness-v2: getPatternGuideForGenerator 헬퍼
 *
 * 사용:
 *   npx tsx scripts/run-harness-golden.ts
 *
 * 중요: callAI 호출 없음 — 순수 함수 회귀 테스트만
 */
import {
  getPatternForSlide,
  diagnoseSlideAgainstPattern,
  buildPatternGuidance,
  resolveIndustryPalette,
  listAllPatterns,
} from '../src/lib/pipeline/infographic/pattern-library';
import {
  buildTamSamSomPreset,
  buildHighlightCardsPreset,
  buildBarChartPreset,
  resolveBuilderChartType,
  getSkeletonForSection,
  buildPresetByAbstractType,
} from '../src/lib/pipeline/infographic/chart-presets';
import {
  selectPatternForContent,
  detectChartCandidates,
  diagnoseAndPlan,
  weaknessToActions,
} from '../src/lib/pipeline/infographic/pattern-selector';
import { getPatternGuideForGenerator } from '../src/lib/pipeline/ppt-harness-v2';

interface TestCase {
  id: string;
  name: string;
  run: () => boolean | string; // true=pass, string=fail message
}

const cases: TestCase[] = [
  // ========================================================================
  // pattern-library
  // ========================================================================
  {
    id: 'lib-01',
    name: 'pattern-library: 11개 패턴 등록',
    run: () => listAllPatterns().length === 11 || `expected 11, got ${listAllPatterns().length}`,
  },
  {
    id: 'lib-02',
    name: 'pattern-library: 직접 매칭 (market)',
    run: () => getPatternForSlide('market')?.koreanName === '시장 분석' || 'market 매칭 실패',
  },
  {
    id: 'lib-03',
    name: 'pattern-library: 별칭 매칭 (marketsize)',
    run: () => getPatternForSlide('marketsize')?.koreanName === '시장 분석' || 'marketsize 별칭 실패',
  },
  {
    id: 'lib-04',
    name: 'pattern-library: 별칭 매칭 (competitor)',
    run: () =>
      getPatternForSlide('competitor')?.koreanName === '경쟁사 분석' || 'competitor 별칭 실패',
  },
  {
    id: 'lib-05',
    name: 'pattern-library: 산업 팔레트 (IT)',
    run: () => resolveIndustryPalette('IT/소프트웨어').primary === '#6366f1' || 'IT 팔레트 실패',
  },
  {
    id: 'lib-06',
    name: 'pattern-library: 산업 팔레트 (수출)',
    run: () => resolveIndustryPalette('수출글로벌').primary === '#dc2626' || '수출 팔레트 실패',
  },
  {
    id: 'lib-07',
    name: 'pattern-library: 빈 슬라이드 약점 진단',
    run: () => {
      const w = diagnoseSlideAgainstPattern({
        slide_type: 'market',
        content: { headline: '시장은 큽니다' },
      });
      if (!w) return '진단 결과 null';
      if (!w.missingFields.includes('stats')) return 'stats 누락 미감지';
      if (!w.missingFields.includes('chart')) return 'chart 누락 미감지';
      if (w.hasNumbers) return 'hasNumbers 잘못 감지';
      return true;
    },
  },
  {
    id: 'lib-08',
    name: 'pattern-library: 패턴 가이드 생성',
    run: () => {
      const g = buildPatternGuidance('problem');
      return g.includes('문제 인식') || '가이드에 한글 라벨 없음';
    },
  },

  // ========================================================================
  // chart-presets
  // ========================================================================
  {
    id: 'chart-01',
    name: 'chart-presets: TAM/SAM/SOM 빌드',
    run: () => {
      const p = buildTamSamSomPreset({ tam: 695, sam: 34.7, som: 17.4, unit: '억$', cagr: '8.3%' });
      if (p.type !== 'tam_sam_som') return 'type 잘못';
      const data = p.data as Record<string, { value?: string }>;
      if (data.tam.value !== '695억$') return 'tam 값 잘못';
      return true;
    },
  },
  {
    id: 'chart-02',
    name: 'chart-presets: highlight_cards 빌드',
    run: () => {
      const p = buildHighlightCardsPreset({
        cards: [{ value: '30억', label: '매출' }, { value: '15명', label: '고용' }],
      });
      if (p.type !== 'highlight_cards') return 'type 잘못';
      const data = p.data as { items?: unknown[] };
      return (data.items?.length === 2) || 'items 수 잘못';
    },
  },
  {
    id: 'chart-03',
    name: 'chart-presets: bar 차트 빌드',
    run: () => {
      const p = buildBarChartPreset({
        categories: ['2024', '2025', '2026'],
        series: [{ name: '매출', values: [30, 80, 200] }],
      });
      return p.type === 'bar' || 'type 잘못';
    },
  },
  {
    id: 'chart-04',
    name: 'chart-presets: 빌더 매핑 (horizontal_bar→bar)',
    run: () =>
      resolveBuilderChartType('horizontal_bar') === 'bar' || 'horizontal_bar 매핑 실패',
  },
  {
    id: 'chart-05',
    name: 'chart-presets: 빌더 매핑 (positioning_map→comparison_table)',
    run: () =>
      resolveBuilderChartType('positioning_map') === 'comparison_table' ||
      'positioning_map 매핑 실패',
  },
  {
    id: 'chart-06',
    name: 'chart-presets: 빌더 매핑 (org_tree→org_chart)',
    run: () => resolveBuilderChartType('org_tree') === 'org_chart' || 'org_tree 매핑 실패',
  },
  {
    id: 'chart-07',
    name: 'chart-presets: 섹션 스켈레톤 (market)',
    run: () => {
      const sk = getSkeletonForSection('market');
      return sk?.type === 'tam_sam_som' || `expected tam_sam_som, got ${sk?.type}`;
    },
  },
  {
    id: 'chart-08',
    name: 'chart-presets: 섹션 스켈레톤 (roadmap)',
    run: () => {
      const sk = getSkeletonForSection('roadmap');
      return sk?.type === 'timeline' || `expected timeline, got ${sk?.type}`;
    },
  },
  {
    id: 'chart-09',
    name: 'chart-presets: 추상 타입 → 프리셋 (donut)',
    run: () => {
      const p = buildPresetByAbstractType('donut');
      return p.type === 'pie' || 'donut 폴백 실패';
    },
  },

  // ========================================================================
  // pattern-selector
  // ========================================================================
  {
    id: 'sel-01',
    name: 'pattern-selector: TAM 키워드 감지',
    run: () => {
      const c = detectChartCandidates('TAM 695억 달러, SAM 34.7억');
      return c[0]?.chartType === 'tam_sam_som' || `1순위 ${c[0]?.chartType}`;
    },
  },
  {
    id: 'sel-02',
    name: 'pattern-selector: 매출 키워드 → bar',
    run: () => {
      const c = detectChartCandidates('연도별 매출 30억, 80억, 200억');
      return c[0]?.chartType === 'bar' || `1순위 ${c[0]?.chartType}`;
    },
  },
  {
    id: 'sel-03',
    name: 'pattern-selector: 비율 키워드 → pie',
    run: () => {
      const c = detectChartCandidates('사업비 배분 인건비 40퍼센트');
      return c.some((x) => x.chartType === 'pie') || 'pie 감지 실패';
    },
  },
  {
    id: 'sel-04',
    name: 'pattern-selector: 조직도 키워드 → org_tree',
    run: () => {
      const c = detectChartCandidates('대표 김XX, CEO 산하 본부 3개');
      return c[0]?.chartType === 'org_tree' || `1순위 ${c[0]?.chartType}`;
    },
  },
  {
    id: 'sel-05',
    name: 'pattern-selector: market 패턴 → tam_sam_som 1순위',
    run: () => {
      const r = selectPatternForContent({
        slideType: 'market',
        text: 'TAM 695억',
      });
      return r.primaryChartType === 'tam_sam_som' || `1순위 ${r.primaryChartType}`;
    },
  },
  {
    id: 'sel-06',
    name: 'pattern-selector: 빈 problem 슬라이드 → P0 액션 (숫자 추가)',
    run: () => {
      const r = diagnoseAndPlan({
        slide_type: 'problem',
        content: { headline: '문제가 있어요' },
      });
      const top = r.actions[0];
      if (!top) return '액션 없음';
      if (top.priority !== 0) return `1순위 P${top.priority}`;
      if (top.action !== 'add_numbers') return `action ${top.action}`;
      return true;
    },
  },
  {
    id: 'sel-07',
    name: 'pattern-selector: weakness → actions 우선순위 정렬',
    run: () => {
      const w = diagnoseSlideAgainstPattern({
        slide_type: 'overview',
        content: {},
      });
      if (!w) return 'weakness null';
      const acts = weaknessToActions('overview', w);
      // 우선순위 오름차순 검증
      for (let i = 1; i < acts.length; i++) {
        if (acts[i].priority < acts[i - 1].priority) return '정렬 안 됨';
      }
      return true;
    },
  },
  {
    id: 'sel-08',
    name: 'pattern-selector: diagnoseAndPlan 종합 (financials)',
    run: () => {
      const r = diagnoseAndPlan({
        slide_type: 'financials',
        content: { headline: '재무 계획' },
      });
      if (!r.recommendation.pattern) return '패턴 매칭 실패';
      if (!r.recommendation.builderChartType) return '빌더 차트 타입 없음';
      return true;
    },
  },

  // ========================================================================
  // ppt-harness-v2 헬퍼
  // ========================================================================
  {
    id: 'v2-01',
    name: 'ppt-harness-v2: Generator 가이드 (market)',
    run: () => {
      const g = getPatternGuideForGenerator('market');
      if (g.builderChartType !== 'tam_sam_som') return `차트 타입 ${g.builderChartType}`;
      if (!g.guidance.includes('시장 분석')) return '가이드 한글 라벨 없음';
      return true;
    },
  },
  {
    id: 'v2-02',
    name: 'ppt-harness-v2: Generator 가이드 (team)',
    run: () => {
      const g = getPatternGuideForGenerator('team');
      return g.builderChartType === 'org_chart' || `team 차트 ${g.builderChartType}`;
    },
  },
];

// ============================================================================
// 실행
// ============================================================================
async function main() {
  console.log('🔧 PPT 하네스 모듈 회귀 테스트');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 ${cases.length}개 케이스\n`);

  const results: Array<{ id: string; name: string; passed: boolean; reason?: string }> = [];

  for (const c of cases) {
    process.stdout.write(`▶ ${c.id} ${c.name}... `);
    let passed = false;
    let reason: string | undefined;
    try {
      const r = c.run();
      if (r === true) {
        passed = true;
      } else {
        reason = typeof r === 'string' ? r : '실패';
      }
    } catch (e) {
      reason = `예외: ${e instanceof Error ? e.message : String(e)}`;
    }
    results.push({ id: c.id, name: c.name, passed, reason });
    console.log(passed ? '✅' : `❌  ${reason}`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`결과: ${passed}/${results.length} 통과 (${failed} 실패)`);

  if (failed > 0) {
    console.log('\n❌ 실패 목록:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => console.log(`  - ${r.id}: ${r.reason}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
