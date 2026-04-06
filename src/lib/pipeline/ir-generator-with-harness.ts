/**
 * IR Generator + 하네스 v2 통합 래퍼
 *
 * ir-generator.ts는 그대로 유지하고, 그 출력을 v2 하네스로 통과시켜
 * 80점 이상이 될 때까지 자동 개선하는 외부 래퍼.
 *
 * 핵심:
 * 1. 기존 generateIRPresentation()은 건드리지 않음 (호환성 유지)
 * 2. 생성 완료 후, DB에서 슬라이드를 다시 로드해 v2 하네스에 통과
 * 3. 개선된 슬라이드를 DB에 다시 저장 (UPDATE)
 * 4. 최종 점수 + 진단 리포트 반환
 *
 * 사용:
 *   import { generateIRWithHarness } from '@/lib/pipeline/ir-generator-with-harness';
 *
 *   for await (const event of generateIRWithHarness({ planId, companyId })) {
 *     console.log(event.type, event.data);
 *   }
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { generateIRPresentation } from './ir-generator';
import {
  runPptHarnessV2,
  type SlideInput,
  type PptHarnessV2Result,
} from './ppt-harness-v2';

export type IRTemplate =
  | 'minimal'
  | 'tech'
  | 'classic'
  | 'professional'
  | 'vibrant'
  | 'custom_ci';

export interface IRWithHarnessOptions {
  planId: string;
  companyId: string;
  template?: IRTemplate;
  /** 통과 점수 (기본 80) */
  passThreshold?: number;
  /** 최대 개선 라운드 (기본 3) */
  maxIterations?: number;
  /** 디버그 로그 */
  verbose?: boolean;
}

export interface IRWithHarnessEvent {
  type:
    | 'progress'
    | 'slide_done'
    | 'generation_complete'
    | 'harness_start'
    | 'harness_iteration'
    | 'harness_complete'
    | 'complete'
    | 'error';
  data: Record<string, unknown>;
}

/**
 * 통합 진입점 — Generator + Harness 자동 실행
 */
export async function* generateIRWithHarness(
  options: IRWithHarnessOptions
): AsyncGenerator<IRWithHarnessEvent> {
  const {
    planId,
    companyId,
    template,
    passThreshold = 80,
    maxIterations = 3,
    verbose = false,
  } = options;

  let presentationId: string | null = null;
  let initialScore = 0;

  // ============================================================
  // 1. ir-generator로 1차 생성
  // ============================================================
  try {
    for await (const event of generateIRPresentation({ planId, companyId, template })) {
      // generation_complete로 마킹해서 통과
      if (event.type === 'complete') {
        presentationId = (event.data.presentationId as string) || null;
        initialScore = (event.data.qualityScore as number) || 0;

        yield {
          type: 'generation_complete',
          data: {
            presentationId,
            initialScore,
            totalSlides: event.data.totalSlides,
          },
        };
        break;
      } else if (event.type === 'error') {
        yield event as IRWithHarnessEvent;
        return;
      } else {
        // progress / slide_done 그대로 통과
        yield event as IRWithHarnessEvent;
      }
    }
  } catch (e) {
    yield {
      type: 'error',
      data: {
        stage: 'generator',
        message: e instanceof Error ? e.message : String(e),
      },
    };
    return;
  }

  if (!presentationId) {
    yield {
      type: 'error',
      data: { stage: 'generator', message: '프레젠테이션 ID를 받지 못함' },
    };
    return;
  }

  // ============================================================
  // 2. 점수가 이미 통과면 하네스 스킵
  // ============================================================
  if (initialScore >= passThreshold) {
    yield {
      type: 'complete',
      data: {
        presentationId,
        finalScore: initialScore,
        harnessApplied: false,
        message: `초기 점수 ${initialScore}점 — 하네스 불필요`,
      },
    };
    return;
  }

  // ============================================================
  // 3. DB에서 슬라이드 다시 로드 → 하네스 입력 형식으로 변환
  // ============================================================
  yield {
    type: 'harness_start',
    data: {
      presentationId,
      initialScore,
      passThreshold,
      maxIterations,
    },
  };

  const supabase = createAdminClient();

  const { data: slideRecords, error: loadError } = await supabase
    .from('ir_slides')
    .select('id, slide_order, slide_type, title, content, notes')
    .eq('presentation_id', presentationId)
    .order('slide_order');

  if (loadError || !slideRecords || slideRecords.length === 0) {
    yield {
      type: 'error',
      data: {
        stage: 'harness_load',
        message: `슬라이드 로드 실패: ${loadError?.message || '데이터 없음'}`,
      },
    };
    return;
  }

  const initialSlides: SlideInput[] = slideRecords.map((rec) => ({
    slide_type: rec.slide_type as string,
    title: rec.title as string,
    content: (rec.content as SlideInput['content']) || {},
    notes: (rec.notes as string) || '',
  }));

  // ============================================================
  // 4. 컨텍스트 빌드 (회사 + 사업계획서 섹션)
  // ============================================================
  const { data: company } = await supabase
    .from('companies')
    .select('name, industry')
    .eq('id', companyId)
    .single();

  const { data: plan } = await supabase
    .from('business_plans')
    .select('title')
    .eq('id', planId)
    .single();

  const { data: planSections } = await supabase
    .from('plan_sections')
    .select('section_name, content')
    .eq('plan_id', planId)
    .order('section_order');

  const harnessContext = {
    title: (plan?.title as string) || 'IR Pitch Deck',
    companyName: (company?.name as string) || '회사',
    industry: (company?.industry as string) || undefined,
    sections: (planSections || []).map((s) => ({
      section_name: s.section_name as string,
      content: (s.content as string) || '',
    })),
  };

  // ============================================================
  // 5. v2 하네스 실행
  // ============================================================
  let harnessResult: PptHarnessV2Result;
  try {
    harnessResult = await runPptHarnessV2({
      initialSlides,
      context: harnessContext,
      verbose,
      passThreshold,
      maxIterations,
    });

    // 라운드별 진행 이벤트
    harnessResult.scoreHistory.forEach((h) => {
      // 동기 내부에서 yield 안 됨 — 별도 이벤트로 마지막에 한 번에 전송
    });

    yield {
      type: 'harness_iteration',
      data: {
        scoreHistory: harnessResult.scoreHistory.map((h) => ({
          iteration: h.iteration,
          score: h.score,
          weakSlideCount: h.weakSlides.length,
        })),
      },
    };
  } catch (e) {
    yield {
      type: 'error',
      data: {
        stage: 'harness_run',
        message: e instanceof Error ? e.message : String(e),
      },
    };
    return;
  }

  // ============================================================
  // 6. 개선된 슬라이드를 DB에 UPDATE (변경된 것만)
  // ============================================================
  let updatedCount = 0;
  for (let i = 0; i < harnessResult.finalSlides.length; i++) {
    const finalSlide = harnessResult.finalSlides[i];
    const originalSlide = initialSlides[i];

    // 컨텐츠가 동일하면 스킵 (불필요한 UPDATE 방지)
    if (
      JSON.stringify(finalSlide.content) === JSON.stringify(originalSlide.content) &&
      finalSlide.title === originalSlide.title
    ) {
      continue;
    }

    const recordId = (slideRecords[i] as { id: string }).id;
    const { error: updateError } = await supabase
      .from('ir_slides')
      .update({
        title: finalSlide.title,
        content: finalSlide.content,
        notes: finalSlide.notes || '',
      })
      .eq('id', recordId);

    if (!updateError) {
      updatedCount++;
    } else if (verbose) {
      console.warn(`[harness] 슬라이드 ${i + 1} 업데이트 실패:`, updateError.message);
    }
  }

  // ============================================================
  // 7. 진단 리포트를 ir_presentations 메타에 저장 (있다면)
  // ============================================================
  try {
    await supabase
      .from('ir_presentations')
      .update({
        // diagnostics는 컬럼이 있을 때만 저장됨 (없으면 무시됨)
        // 안전하게 별도 jsonb metadata 컬럼 권장
        updated_at: new Date().toISOString(),
      })
      .eq('id', presentationId);
  } catch {
    // 실패해도 무시 (메타 저장은 부수효과)
  }

  // ============================================================
  // 8. 완료 이벤트
  // ============================================================
  yield {
    type: 'harness_complete',
    data: {
      status: harnessResult.status,
      iterations: harnessResult.iterations,
      finalScore: harnessResult.finalScore,
      improvedSlides: updatedCount,
      diagnostics: harnessResult.diagnostics,
    },
  };

  yield {
    type: 'complete',
    data: {
      presentationId,
      finalScore: harnessResult.finalScore,
      initialScore,
      improvement: harnessResult.finalScore - initialScore,
      iterations: harnessResult.iterations,
      improvedSlides: updatedCount,
      harnessApplied: true,
      status: harnessResult.status,
    },
  };
}

// ============================================================================
// 비-제너레이터 버전 (테스트/스크립트 용)
// ============================================================================

/**
 * 단순 호출 버전 — 모든 이벤트 수집 후 최종 결과만 반환
 */
export async function generateIRWithHarnessOnce(
  options: IRWithHarnessOptions
): Promise<{
  success: boolean;
  presentationId?: string;
  initialScore?: number;
  finalScore?: number;
  iterations?: number;
  status?: string;
  error?: string;
}> {
  let presentationId: string | undefined;
  let initialScore: number | undefined;
  let finalScore: number | undefined;
  let iterations: number | undefined;
  let status: string | undefined;
  let errorMsg: string | undefined;

  for await (const event of generateIRWithHarness(options)) {
    if (event.type === 'generation_complete') {
      presentationId = event.data.presentationId as string;
      initialScore = event.data.initialScore as number;
    } else if (event.type === 'harness_complete') {
      finalScore = event.data.finalScore as number;
      iterations = event.data.iterations as number;
      status = event.data.status as string;
    } else if (event.type === 'complete' && finalScore === undefined) {
      finalScore = event.data.finalScore as number;
    } else if (event.type === 'error') {
      errorMsg = (event.data.message as string) || 'unknown error';
    }
  }

  return {
    success: !errorMsg,
    presentationId,
    initialScore,
    finalScore,
    iterations,
    status,
    error: errorMsg,
  };
}
