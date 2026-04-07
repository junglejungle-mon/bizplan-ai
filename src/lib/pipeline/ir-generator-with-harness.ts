/**
 * IR Generator + 하네스 v2 + 인터뷰 컨텍스트 통합 래퍼
 *
 * ir-generator.ts는 그대로 유지하고, 그 출력을 v2 하네스로 통과시켜
 * 80점 이상이 될 때까지 자동 개선.
 *
 * 핵심:
 * 1. 기존 generateIRPresentation()은 건드리지 않음 (호환성 유지)
 * 2. 생성 완료 후, DB에서 슬라이드를 다시 로드해 v2 하네스에 통과
 * 3. 인터뷰 답변(있으면)을 컨텍스트에 자동 주입
 * 4. 개선된 슬라이드를 DB에 다시 저장 (UPDATE)
 * 5. 최종 점수 + 진단 리포트 반환
 *
 * 변경 이력 (Round 1 정리):
 * - 죽은 export `generateIRWithHarnessOnce` 제거 (호출 0건)
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { generateIRPresentation } from './ir-generator';
import {
  runPptHarnessV2,
  type SlideInput,
  type PptHarnessV2Result,
} from './ppt-harness-v2';
import {
  loadInterviewContext,
  formatInterviewForPrompt,
} from '@/lib/interview/context-injector';

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
  /** 하네스 자동 적용 (false면 ir-generator만 실행) */
  applyHarness?: boolean;
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
    applyHarness = true,
  } = options;

  let presentationId: string | null = null;
  let initialScore = 0;

  // ============================================================
  // 1. ir-generator로 1차 생성 (스트리밍 그대로 통과)
  // ============================================================
  try {
    for await (const event of generateIRPresentation({ planId, companyId, template })) {
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
  // 2. 하네스 적용 여부 판정
  // ============================================================
  if (!applyHarness) {
    yield {
      type: 'complete',
      data: {
        presentationId,
        finalScore: initialScore,
        harnessApplied: false,
        message: 'applyHarness=false — 하네스 스킵',
      },
    };
    return;
  }

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
  // 3. DB에서 슬라이드 다시 로드
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
  // 4. 컨텍스트 빌드 (회사 + 사업계획서 섹션 + 인터뷰 답변)
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

  // 인터뷰 답변 로드 (있으면 컨텍스트에 자동 주입)
  const interviewCtx = await loadInterviewContext(supabase, companyId);

  // 인터뷰 답변을 사업계획서 섹션 컨텍스트로 추가
  const augmentedSections = [
    ...((planSections || []).map((s) => ({
      section_name: s.section_name as string,
      content: (s.content as string) || '',
    }))),
  ];

  if (interviewCtx.hasAnswers) {
    augmentedSections.unshift({
      section_name: '회사 인터뷰 (사용자 직접 입력)',
      content: formatInterviewForPrompt(interviewCtx),
    });
  }

  const harnessContext = {
    title: (plan?.title as string) || 'IR Pitch Deck',
    companyName: (company?.name as string) || '회사',
    industry: (company?.industry as string) || undefined,
    sections: augmentedSections,
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

    yield {
      type: 'harness_iteration',
      data: {
        scoreHistory: harnessResult.scoreHistory.map((entry) => ({
          iteration: entry.iteration,
          score: entry.score,
          weakSlideCount: entry.weakSlides.length,
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
  // 7. 메타 업데이트
  // ============================================================
  try {
    await supabase
      .from('ir_presentations')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('id', presentationId);
  } catch {
    // 무시
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
      interviewApplied: interviewCtx.hasAnswers,
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
      interviewApplied: interviewCtx.hasAnswers,
      status: harnessResult.status,
    },
  };
}
