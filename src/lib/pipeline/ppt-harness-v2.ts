/**
 * PPT 하네스 v2 — pattern-selector 통합 버전
 *
 * v1과의 차이:
 * 1. 약한 슬라이드 식별 시 pattern-selector의 diagnoseAndPlan() 사용
 *    → 단순 점수가 아니라 패턴 기반 정밀 진단
 * 2. 개선 프롬프트에 패턴 가이드 + 차트 스켈레톤 자동 주입
 *    → AI가 어떤 차트/레이아웃을 만들어야 하는지 명확히 인지
 * 3. 우선순위 액션 리스트로 개선 순서 명확화
 * 4. 슬라이드별 진단 결과 추적 (어떤 액션이 적용됐는지)
 *
 * 사용:
 *   import { runPptHarnessV2 } from '@/lib/pipeline/ppt-harness-v2';
 *   const result = await runPptHarnessV2({ initialSlides, context, verbose: true });
 */
import { autoScorePpt, type PptScoreResult } from '@/lib/quality/ppt-scorer';
import { callAI } from '@/lib/ai';
import {
  diagnoseAndPlan,
  type ImprovementAction,
  type PatternRecommendation,
} from './infographic/pattern-selector';
import {
  buildPatternGuidance,
  resolveIndustryPalette,
} from './infographic/pattern-library';

const PASS_THRESHOLD = 80;
const MAX_ITERATIONS = 3;

// ============================================================================
// 1. 타입
// ============================================================================

export interface SlideInput {
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

export interface SlideDiagnosis {
  slide_type: string;
  needsImprovement: boolean;
  actions: ImprovementAction[];
  recommendation: PatternRecommendation;
}

export interface PptHarnessV2Result {
  status: 'passed' | 'escalated' | 'failed';
  iterations: number;
  finalSlides: SlideInput[];
  finalScore: number;
  scoreHistory: Array<{
    iteration: number;
    score: number;
    weakSlides: string[];
    diagnosis: SlideDiagnosis[];
  }>;
  evaluatorReport: Omit<PptScoreResult, 'presentation_id'>;
  diagnostics: string;
}

export interface PptHarnessV2Options {
  initialSlides: SlideInput[];
  context: {
    title: string;
    companyName: string;
    industry?: string;
    sections: Array<{ section_name: string; content: string }>;
  };
  verbose?: boolean;
  /** 통과 점수 (기본 80) */
  passThreshold?: number;
  /** 최대 반복 횟수 (기본 3) */
  maxIterations?: number;
}

// ============================================================================
// 2. 메인 진입점
// ============================================================================

export async function runPptHarnessV2(
  options: PptHarnessV2Options
): Promise<PptHarnessV2Result> {
  const { initialSlides, context, verbose = false } = options;
  const passThreshold = options.passThreshold ?? PASS_THRESHOLD;
  const maxIterations = options.maxIterations ?? MAX_ITERATIONS;

  let currentSlides = [...initialSlides];
  const scoreHistory: PptHarnessV2Result['scoreHistory'] = [];
  let lastReport: Omit<PptScoreResult, 'presentation_id'> | null = null;

  for (let iter = 1; iter <= maxIterations; iter++) {
    if (verbose) {
      console.log(`\n=== PPT Harness v2 Iteration ${iter}/${maxIterations} ===`);
    }

    // 1. 자동 채점
    const report = autoScorePpt(currentSlides);
    lastReport = report;

    // 2. 슬라이드별 정밀 진단 (pattern-selector 활용)
    const diagnoses = diagnoseAllSlides(currentSlides);
    const weakDiagnoses = diagnoses.filter((d) => d.needsImprovement);

    scoreHistory.push({
      iteration: iter,
      score: report.total_score,
      weakSlides: weakDiagnoses.map((d) => d.slide_type),
      diagnosis: diagnoses,
    });

    if (verbose) {
      console.log(`  Score: ${report.total_score}/100`);
      console.log(`  진단된 약한 슬라이드: ${weakDiagnoses.length}/${currentSlides.length}`);
      weakDiagnoses.forEach((d) => {
        const topActions = d.actions
          .slice(0, 3)
          .map((a) => `[P${a.priority}]${a.action}`)
          .join(' ');
        console.log(`    - ${d.slide_type}: ${topActions}`);
      });
      report.improvement_suggestions.slice(0, 3).forEach((s, i) =>
        console.log(`  채점기 제안 ${i + 1}: ${s}`)
      );
    }

    // 3. 통과 시 종료
    if (report.total_score >= passThreshold) {
      return {
        status: 'passed',
        iterations: iter,
        finalSlides: currentSlides,
        finalScore: report.total_score,
        scoreHistory,
        evaluatorReport: report,
        diagnostics: buildDiagnostics(scoreHistory, 'passed'),
      };
    }

    // 4. 마지막 라운드면 에스컬레이션
    if (iter === maxIterations) {
      return {
        status: 'escalated',
        iterations: iter,
        finalSlides: currentSlides,
        finalScore: report.total_score,
        scoreHistory,
        evaluatorReport: report,
        diagnostics: buildDiagnostics(scoreHistory, 'escalated'),
      };
    }

    // 5. 개선할 슬라이드 없으면 중단
    if (weakDiagnoses.length === 0) {
      if (verbose) {
        console.log('  ⚠ 약한 슬라이드 0개인데 점수 미달 — 전체 슬라이드 부족 가능성');
      }
      break;
    }

    // 6. 약한 슬라이드만 패턴 기반으로 개선
    try {
      currentSlides = await improveWeakSlidesV2(
        currentSlides,
        weakDiagnoses,
        context,
        verbose
      );
    } catch (e) {
      if (verbose) {
        console.error(
          `  ❌ improvement failed: ${e instanceof Error ? e.message : 'unknown'}`
        );
      }
      return {
        status: 'failed',
        iterations: iter,
        finalSlides: currentSlides,
        finalScore: report.total_score,
        scoreHistory,
        evaluatorReport: report,
        diagnostics: buildDiagnostics(scoreHistory, 'failed'),
      };
    }
  }

  return {
    status: 'escalated',
    iterations: maxIterations,
    finalSlides: currentSlides,
    finalScore: lastReport?.total_score ?? 0,
    scoreHistory,
    evaluatorReport: lastReport!,
    diagnostics: buildDiagnostics(scoreHistory, 'escalated'),
  };
}

// ============================================================================
// 3. 슬라이드 진단 (pattern-selector 통합)
// ============================================================================

function diagnoseAllSlides(slides: SlideInput[]): SlideDiagnosis[] {
  return slides.map((slide) => {
    const result = diagnoseAndPlan(slide);

    // 개선 필요 판정 기준:
    // - 약점이 1개 이상 있고
    // - P0~P2 우선순위 액션이 1개 이상이면 개선 대상
    const highPriorityActions = result.actions.filter((a) => a.priority <= 2);
    const needsImprovement =
      result.actions.length > 0 && highPriorityActions.length > 0;

    return {
      slide_type: slide.slide_type,
      needsImprovement,
      actions: result.actions,
      recommendation: result.recommendation,
    };
  });
}

// ============================================================================
// 4. 개선 — 패턴 가이드 자동 주입
// ============================================================================

async function improveWeakSlidesV2(
  allSlides: SlideInput[],
  weakDiagnoses: SlideDiagnosis[],
  context: PptHarnessV2Options['context'],
  verbose: boolean
): Promise<SlideInput[]> {
  const improvedMap = new Map<string, SlideInput>();
  const palette = resolveIndustryPalette(context.industry);

  for (const diagnosis of weakDiagnoses) {
    const original = allSlides.find((s) => s.slide_type === diagnosis.slide_type);
    if (!original) continue;

    const prompt = buildImprovementPrompt(original, diagnosis, context, palette);

    if (verbose) {
      console.log(`  ⚙ 개선 중: ${diagnosis.slide_type}`);
    }

    try {
      const result = await callAI(prompt, {
        model: 'sonnet',
        context: `ppt-harness-v2-${diagnosis.slide_type}`,
        timeoutMs: 90_000,
      });

      const cleaned = result.output.replace(/```json\n?|\n?```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1) {
        improvedMap.set(diagnosis.slide_type, original);
        continue;
      }
      const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
      const improved = JSON.parse(jsonText) as SlideInput;

      // slide_type은 강제로 원본 유지
      improved.slide_type = original.slide_type;
      if (!improved.title) improved.title = original.title;

      improvedMap.set(diagnosis.slide_type, improved);
    } catch (e) {
      if (verbose) {
        console.warn(
          `    ⚠ ${diagnosis.slide_type} 개선 실패: ${e instanceof Error ? e.message : 'unknown'}`
        );
      }
      improvedMap.set(diagnosis.slide_type, original);
    }
  }

  return allSlides.map((s) =>
    improvedMap.has(s.slide_type) ? improvedMap.get(s.slide_type)! : s
  );
}

/**
 * 개선 프롬프트 빌더 — 패턴 가이드 + 액션 + 차트 스켈레톤 모두 주입
 */
function buildImprovementPrompt(
  slide: SlideInput,
  diagnosis: SlideDiagnosis,
  context: PptHarnessV2Options['context'],
  palette: { primary: string; secondary: string }
): string {
  const guidance = buildPatternGuidance(slide.slide_type);
  const actionList = diagnosis.actions
    .slice(0, 6)
    .map((a, i) => `${i + 1}. [P${a.priority}] ${a.description}`)
    .join('\n');

  const skeletonHint = diagnosis.recommendation.chartSkeleton
    ? `\n[권장 차트 스켈레톤]\n${JSON.stringify(diagnosis.recommendation.chartSkeleton, null, 2)}`
    : '';

  const chartTypeHint = diagnosis.recommendation.builderChartType
    ? `\n[권장 차트 type]: "${diagnosis.recommendation.builderChartType}"`
    : '';

  const sectionContext = context.sections
    .filter((s) => s.content && s.content.length > 0)
    .slice(0, 3)
    .map((s) => `[${s.section_name}]\n${s.content.slice(0, 500)}`)
    .join('\n\n');

  return `당신은 IR PPT 슬라이드 개선 전문가입니다. 평가위원의 첫인상을 결정하는 디자인 가이드를 엄격히 따르세요.

[현재 슬라이드 — 점수가 낮음]
${JSON.stringify(slide, null, 2)}

[패턴 가이드]
${guidance}

[필요한 개선 액션 — 우선순위 순]
${actionList}
${chartTypeHint}
${skeletonHint}

[색상 가이드]
- 주색상: ${palette.primary}
- 보조색상: ${palette.secondary}
(차트 색상 스펙에 참고)

[회사]
${context.companyName}${context.industry ? ` (${context.industry})` : ''}

[사업계획서 관련 섹션]
${sectionContext}

[출력 형식]
JSON만 출력 (마크다운 코드 블록 금지). 다음 형식 그대로:
{
  "slide_type": "${slide.slide_type}",
  "title": "...",
  "content": {
    "headline": "임팩트 있는 한 문장",
    "subtext": "보조 설명 1-2 문장",
    "bullets": ["불릿 3-5개, 각각 구체적 수치 포함"],
    "stats": [{"icon": "📊", "value": "30억", "label": "매출 목표"}],
    "chart": {"type": "${diagnosis.recommendation.builderChartType || 'bar'}", "title": "...", "data": {}}
  }
}

[엄격한 규칙]
1. 모든 주장에 수치 근거 (15조원, 30%, 1억명, 695억$ 같은 구체적 숫자)
2. 헤드라인은 한 문장으로 임팩트
3. 액션 리스트의 [P0], [P1] 항목은 반드시 해결
4. 권장 차트 스켈레톤이 있으면 그 type을 반드시 사용
5. JSON만 출력 — 설명/주석/마크다운 금지
6. slide_type은 "${slide.slide_type}" 그대로 유지`;
}

// ============================================================================
// 5. 진단 리포트
// ============================================================================

function buildDiagnostics(
  history: PptHarnessV2Result['scoreHistory'],
  status: 'passed' | 'escalated' | 'failed'
): string {
  const lines: string[] = [];
  lines.push('# PPT Harness v2 진단');
  lines.push(`Status: ${status}`);
  lines.push(`Iterations: ${history.length}`);
  lines.push('');
  lines.push('## 점수 변화');
  history.forEach((h) => {
    lines.push(
      `  Iter ${h.iteration}: ${h.score}/100 (약한 슬라이드: ${h.weakSlides.join(', ') || '없음'})`
    );
  });

  // 마지막 라운드의 액션 분포
  const last = history[history.length - 1];
  if (last && last.diagnosis.length > 0) {
    lines.push('');
    lines.push('## 마지막 라운드 — 슬라이드별 진단');
    last.diagnosis
      .filter((d) => d.needsImprovement)
      .forEach((d) => {
        lines.push(`### ${d.slide_type}`);
        lines.push(`  추천 차트: ${d.recommendation.primaryChartType ?? '-'}`);
        lines.push(`  액션 수: ${d.actions.length}`);
        d.actions.slice(0, 4).forEach((a) => {
          lines.push(`    - [P${a.priority}] ${a.description}`);
        });
      });
  }

  if (status === 'escalated') {
    lines.push('');
    lines.push('## 권장 조치');
    lines.push('- 사업계획서 섹션에 더 많은 수치/통계 추가 후 재시도');
    lines.push('- 시장 분석 섹션 강화 (TAM/SAM/SOM)');
    lines.push('- 경쟁사 비교 데이터 추가');
    lines.push('- maxIterations를 5 이상으로 늘려 재시도');
  }

  return lines.join('\n');
}

// ============================================================================
// 6. 외부 헬퍼 — Generator가 처음부터 패턴 적용해서 만들고 싶을 때
// ============================================================================

/**
 * 패턴 가이드를 Generator 프롬프트에 끼우기 좋은 형태로 반환
 */
export function getPatternGuideForGenerator(slideType: string): {
  guidance: string;
  builderChartType: string | null;
  chartSkeleton: unknown;
} {
  const result = diagnoseAndPlan({
    slide_type: slideType,
    content: {},
  });
  return {
    guidance: buildPatternGuidance(slideType),
    builderChartType: result.recommendation.builderChartType,
    chartSkeleton: result.recommendation.chartSkeleton,
  };
}
