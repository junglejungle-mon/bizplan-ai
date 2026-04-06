/**
 * PPT 하네스 — Generator + Evaluator + Feedback Loop
 *
 * 핵심 원칙: 만드는 놈 ≠ 평가하는 놈
 *
 * 흐름:
 *   1. Planner: 사업계획서 → 슬라이드 구조 설계
 *   2. Generator: 각 슬라이드 작성 (lib/pipeline/ir-generator.ts 활용)
 *   3. Evaluator: 100점 채점 (lib/quality/ppt-scorer.ts 활용, 블라인드)
 *   4. Feedback: 80점 미만이면 약한 슬라이드만 재작성 (최대 3라운드)
 *
 * 사용법:
 *   import { runPptHarness } from '@/lib/pipeline/ppt-harness';
 *   const result = await runPptHarness({ planId, companyId });
 */
import { autoScorePpt, type PptScoreResult } from '@/lib/quality/ppt-scorer';
import { callAI } from '@/lib/ai';

const PASS_THRESHOLD = 80;
const MAX_ITERATIONS = 3;

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

export interface PptHarnessResult {
  status: 'passed' | 'escalated' | 'failed';
  iterations: number;
  finalSlides: SlideInput[];
  finalScore: number;
  scoreHistory: Array<{
    iteration: number;
    score: number;
    weakSlides: string[];
  }>;
  evaluatorReport: Omit<PptScoreResult, 'presentation_id'>;
  diagnostics: string;
}

export interface PptHarnessOptions {
  /** 초기 슬라이드 (Generator가 만든 1차 결과) */
  initialSlides: SlideInput[];
  /** 사업계획서 컨텍스트 (재작성 시 필요) */
  context: {
    title: string;
    companyName: string;
    sections: Array<{ section_name: string; content: string }>;
  };
  /** 디버그 로그 출력 */
  verbose?: boolean;
}

/**
 * 메인 진입점 — 슬라이드를 받아 품질이 80점 이상이 될 때까지 개선
 */
export async function runPptHarness(
  options: PptHarnessOptions
): Promise<PptHarnessResult> {
  const { initialSlides, context, verbose = false } = options;

  let currentSlides = [...initialSlides];
  const scoreHistory: PptHarnessResult['scoreHistory'] = [];
  let lastReport: Omit<PptScoreResult, 'presentation_id'> | null = null;

  for (let iter = 1; iter <= MAX_ITERATIONS; iter++) {
    if (verbose) {
      console.log(`\n=== PPT Harness Iteration ${iter}/${MAX_ITERATIONS} ===`);
    }

    // 1. 평가
    const report = autoScorePpt(currentSlides);
    lastReport = report;
    const weakSlides = identifyWeakSlides(currentSlides, report);

    scoreHistory.push({
      iteration: iter,
      score: report.total_score,
      weakSlides: weakSlides.map((s) => s.slide_type),
    });

    if (verbose) {
      console.log(`  Score: ${report.total_score}/100`);
      console.log(`  Weak slides: ${weakSlides.length}`);
      report.improvement_suggestions.forEach((s, i) =>
        console.log(`    ${i + 1}. ${s}`)
      );
    }

    // 2. 통과 시 종료
    if (report.total_score >= PASS_THRESHOLD) {
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

    // 3. 마지막 라운드면 에스컬레이션
    if (iter === MAX_ITERATIONS) {
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

    // 4. 약한 슬라이드만 재작성
    if (weakSlides.length === 0) {
      // 약한 슬라이드를 못 찾았는데 점수도 낮음 → 전체적 개선 필요
      // 이 경우는 더 많은 슬라이드 추가 필요
      break;
    }

    try {
      currentSlides = await improveWeakSlides(
        currentSlides,
        weakSlides,
        report,
        context
      );
    } catch (e) {
      if (verbose) {
        console.error(
          `  ❌ improvement failed: ${e instanceof Error ? e.message : 'unknown'}`
        );
      }
      // 개선 실패 시 그대로 반환
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
    iterations: MAX_ITERATIONS,
    finalSlides: currentSlides,
    finalScore: lastReport?.total_score ?? 0,
    scoreHistory,
    evaluatorReport: lastReport!,
    diagnostics: buildDiagnostics(scoreHistory, 'escalated'),
  };
}

/**
 * 약한 슬라이드 식별 (점수가 낮은 항목 기준)
 */
function identifyWeakSlides(
  slides: SlideInput[],
  report: Omit<PptScoreResult, 'presentation_id'>
): SlideInput[] {
  const weak: SlideInput[] = [];

  // 점수가 낮은 항목들을 보고 어떤 슬라이드가 문제인지 추정
  if (report.score_text_density < 10) {
    // 텍스트 밀도 부족 → 헤드라인/불릿이 너무 적은 슬라이드
    weak.push(
      ...slides.filter((s) => {
        const bulletCount = s.content?.bullets?.length || 0;
        const hasHeadline = !!s.content?.headline;
        return !hasHeadline || bulletCount < 2;
      })
    );
  }

  if (report.score_numeric_data < 10) {
    // 수치 데이터 부족 → 숫자가 없는 데이터 슬라이드
    const dataSlideTypes = ['market', 'traction', 'financials', 'ask'];
    weak.push(
      ...slides.filter((s) => {
        if (!dataSlideTypes.includes(s.slide_type)) return false;
        const text = JSON.stringify(s.content);
        return !/\d/.test(text);
      })
    );
  }

  if (report.score_visual_elements < 10) {
    // 시각 요소 부족 → 차트/스탯 없는 슬라이드
    weak.push(
      ...slides.filter((s) => {
        return !s.content?.chart && !s.content?.stats?.length;
      })
    );
  }

  // 중복 제거
  return Array.from(new Set(weak));
}

/**
 * 약한 슬라이드만 AI로 재작성
 */
async function improveWeakSlides(
  allSlides: SlideInput[],
  weakSlides: SlideInput[],
  report: Omit<PptScoreResult, 'presentation_id'>,
  context: PptHarnessOptions['context']
): Promise<SlideInput[]> {
  const improvedMap = new Map<string, SlideInput>();

  for (const weak of weakSlides) {
    const issues = report.improvement_suggestions.join('; ');

    const prompt = `당신은 IR PPT 슬라이드 개선 전문가입니다.

현재 슬라이드 (점수가 낮음):
${JSON.stringify(weak, null, 2)}

문제점:
${issues}

회사: ${context.companyName}
사업계획서 관련 섹션:
${context.sections
  .filter((s) => s.content && s.content.length > 0)
  .slice(0, 3)
  .map((s) => `[${s.section_name}]\n${s.content.slice(0, 500)}`)
  .join('\n\n')}

위 슬라이드를 개선해서 JSON으로만 답해 (마크다운 코드 블록 없이):
{
  "slide_type": "${weak.slide_type}",
  "title": "...",
  "content": {
    "headline": "임팩트 있는 한 문장",
    "subtext": "보조 설명 1-2 문장",
    "bullets": ["불릿 3-5개", "구체적 수치 포함", "..."],
    "stats": [{"value": "30억", "label": "매출 목표"}, ...],
    "chart": {"type": "bar|pie|line|highlight_cards", "title": "...", "data": {...}}
  }
}

핵심 개선 원칙:
1. 모든 주장에 수치 근거 (15조원, 30%, 1억명)
2. 헤드라인은 한 문장으로 임팩트
3. 불릿 3-5개, 각각 구체적
4. 차트나 stats 카드 1개 이상 포함
5. JSON만 출력, 다른 설명 금지`;

    try {
      const result = await callAI(prompt, {
        model: 'sonnet',
        context: `ppt-harness-improve-${weak.slide_type}`,
        timeoutMs: 90_000,
      });

      const cleaned = result.output.replace(/```json\n?|\n?```/g, '').trim();
      const firstBrace = cleaned.indexOf('{');
      const lastBrace = cleaned.lastIndexOf('}');
      const jsonText = cleaned.slice(firstBrace, lastBrace + 1);
      const improved = JSON.parse(jsonText) as SlideInput;

      improvedMap.set(weak.slide_type, improved);
    } catch {
      // 개선 실패는 원본 유지
      improvedMap.set(weak.slide_type, weak);
    }
  }

  // 원본 순서 유지하며 개선된 것 교체
  return allSlides.map((s) =>
    improvedMap.has(s.slide_type) ? improvedMap.get(s.slide_type)! : s
  );
}

/**
 * 진단 리포트 생성
 */
function buildDiagnostics(
  history: PptHarnessResult['scoreHistory'],
  status: 'passed' | 'escalated' | 'failed'
): string {
  const lines: string[] = [];
  lines.push(`# PPT Harness 진단`);
  lines.push(`Status: ${status}`);
  lines.push(`Iterations: ${history.length}`);
  lines.push('');
  lines.push('## 점수 변화');
  history.forEach((h) => {
    lines.push(
      `  Iter ${h.iteration}: ${h.score}/100 (약한 슬라이드: ${h.weakSlides.join(', ') || '없음'})`
    );
  });

  if (status === 'escalated') {
    lines.push('');
    lines.push('## 권장 조치');
    lines.push(
      '- 사업계획서 섹션에 더 많은 수치/통계 추가 후 재시도'
    );
    lines.push(
      '- 시장 분석 섹션 강화 (TAM/SAM/SOM)'
    );
    lines.push('- 경쟁사 비교 데이터 추가');
  }

  return lines.join('\n');
}
