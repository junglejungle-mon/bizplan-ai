/**
 * Plan Generator + 인터뷰 답변 통합 래퍼
 *
 * 사용자가 /workflow/interview에서 채운 7개 답변을 사업계획서 생성에 자동 주입.
 *
 * 동작:
 * 1. 회사 ID로 인터뷰 답변 로드
 * 2. 회사의 business_content에 인터뷰 답변을 임시로 합쳐서 보강
 * 3. 기존 generateBusinessPlan 호출 (이미 business_content를 광범위하게 사용함)
 * 4. 생성 완료 후 business_content를 원본으로 복원 (try/finally)
 *
 * 이 방식의 장점:
 * - 기존 plan-generator.ts를 0줄도 수정하지 않음
 * - 인터뷰 답변이 자연스럽게 LLM 컨텍스트에 흘러들어감
 * - 실패 시에도 원본 회사 정보 보존
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { generateBusinessPlan } from './plan-generator';
import {
  loadInterviewContext,
  formatInterviewForPrompt,
} from '@/lib/interview/context-injector';

export interface PlanGeneratorWithInterviewOptions {
  planId: string;
  companyId: string;
  programId?: string;
  templateOcrText?: string;
  /** 인터뷰 답변 자동 주입 (기본 true) */
  applyInterviewContext?: boolean;
}

export interface PlanGenEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * 메인 진입점 — 인터뷰 컨텍스트를 자동으로 주입한 후 generateBusinessPlan 호출
 */
export async function* generateBusinessPlanWithInterview(
  options: PlanGeneratorWithInterviewOptions
): AsyncGenerator<PlanGenEvent> {
  const { planId, companyId, programId, templateOcrText, applyInterviewContext = true } = options;

  const supabase = createAdminClient();
  let originalBusinessContent: string | null = null;
  let augmentedContent: string | null = null;
  let interviewApplied = false;

  // ============================================================
  // 1. 인터뷰 답변 로드 (있으면)
  // ============================================================
  if (applyInterviewContext) {
    try {
      const ctx = await loadInterviewContext(supabase, companyId);

      if (ctx.hasAnswers) {
        // 회사 원본 business_content 백업
        const { data: company } = await supabase
          .from('companies')
          .select('business_content')
          .eq('id', companyId)
          .maybeSingle();

        originalBusinessContent =
          (company?.business_content as string | null) || null;

        // 인터뷰 답변을 컨텍스트로 추가
        const interviewBlock = formatInterviewForPrompt(ctx);
        augmentedContent =
          (originalBusinessContent || '').trim() +
          (originalBusinessContent ? '\n\n' : '') +
          interviewBlock;

        // 회사의 business_content 임시 업데이트 (plan-generator가 읽을 때 인터뷰 포함)
        const { error: updateErr } = await supabase
          .from('companies')
          .update({ business_content: augmentedContent })
          .eq('id', companyId);

        if (!updateErr) {
          interviewApplied = true;

          yield {
            type: 'progress',
            data: {
              step: '인터뷰 답변 적용 (사용자 직접 입력 데이터 통합)',
              progress: 5,
              interviewAnswerCount: ctx.answers.length,
            },
          };
        }
      }
    } catch (e) {
      // 인터뷰 로드 실패해도 계획서 생성은 계속 진행
      console.warn(
        '[plan-with-interview] 인터뷰 컨텍스트 로드 실패:',
        e instanceof Error ? e.message : 'unknown'
      );
    }
  }

  // ============================================================
  // 2. 기존 generateBusinessPlan 호출 (스트리밍 그대로 통과)
  // ============================================================
  try {
    for await (const event of generateBusinessPlan({
      planId,
      companyId,
      programId,
      templateOcrText,
    })) {
      // 이벤트에 interviewApplied 플래그 추가
      if (event.type === 'complete') {
        yield {
          type: 'complete',
          data: {
            ...event.data,
            interviewApplied,
          },
        };
      } else {
        yield event;
      }
    }
  } catch (e) {
    yield {
      type: 'error',
      data: {
        message: e instanceof Error ? e.message : String(e),
      },
    };
  } finally {
    // ============================================================
    // 3. business_content 원본 복원 (실패해도 무조건)
    // ============================================================
    if (interviewApplied && augmentedContent !== null) {
      try {
        await supabase
          .from('companies')
          .update({ business_content: originalBusinessContent })
          .eq('id', companyId);
      } catch (e) {
        console.error(
          '[plan-with-interview] 원본 business_content 복원 실패:',
          e instanceof Error ? e.message : 'unknown'
        );
      }
    }
  }
}
