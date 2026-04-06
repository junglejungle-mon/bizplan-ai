/**
 * 워크플로우 5단계 스테퍼
 *
 * 사용자 시나리오:
 * ① 회사 정보  →  ② AI 인터뷰  →  ③ 프로그램 매칭  →  ④ 사업계획서  →  ⑤ 양식/PPT
 */
'use client';

import { Check, Lock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type WorkflowStepStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type WorkflowStepKey =
  | 'company'
  | 'interview'
  | 'matching'
  | 'plan'
  | 'output';

export interface WorkflowStepInfo {
  key: WorkflowStepKey;
  number: number;
  label: string;
  shortLabel: string;
  description: string;
  status: WorkflowStepStatus;
}

interface WorkflowStepperProps {
  steps: WorkflowStepInfo[];
  activeStep: WorkflowStepKey;
  onStepClick?: (step: WorkflowStepKey) => void;
}

export function WorkflowStepper({ steps, activeStep, onStepClick }: WorkflowStepperProps) {
  return (
    <div className="w-full">
      {/* Desktop: 가로 */}
      <div className="hidden md:flex items-center justify-between gap-2">
        {steps.map((step, idx) => (
          <div key={step.key} className="flex-1 flex items-center">
            <StepNode
              step={step}
              isActive={step.key === activeStep}
              onClick={onStepClick}
            />
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1 mx-1 transition-colors',
                  step.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* Mobile: 세로 */}
      <div className="md:hidden flex flex-col gap-3">
        {steps.map((step) => (
          <div key={step.key} className="flex items-center gap-3">
            <StepNode
              step={step}
              isActive={step.key === activeStep}
              onClick={onStepClick}
            />
            <div className="flex-1">
              <div
                className={cn(
                  'text-sm font-medium',
                  step.status === 'locked' ? 'text-slate-400' : 'text-slate-900'
                )}
              >
                {step.label}
              </div>
              <div className="text-xs text-slate-500">{step.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StepNode({
  step,
  isActive,
  onClick,
}: {
  step: WorkflowStepInfo;
  isActive: boolean;
  onClick?: (k: WorkflowStepKey) => void;
}) {
  const clickable = step.status !== 'locked' && !!onClick;

  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => clickable && onClick?.(step.key)}
      className={cn(
        'group relative flex flex-col items-center min-w-[64px] transition-all',
        clickable ? 'cursor-pointer hover:scale-105' : 'cursor-default'
      )}
    >
      <div
        className={cn(
          'w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center font-semibold text-sm md:text-base border-2 transition-all',
          step.status === 'completed' &&
            'bg-green-500 border-green-500 text-white shadow-md',
          step.status === 'in_progress' &&
            'bg-blue-500 border-blue-500 text-white shadow-md ring-4 ring-blue-100',
          step.status === 'available' &&
            'bg-white border-blue-500 text-blue-600',
          step.status === 'locked' &&
            'bg-slate-100 border-slate-200 text-slate-400',
          isActive &&
            step.status !== 'locked' &&
            'ring-4 ring-blue-200'
        )}
      >
        {step.status === 'completed' ? (
          <Check className="w-5 h-5 md:w-6 md:h-6" />
        ) : step.status === 'in_progress' ? (
          <Loader2 className="w-5 h-5 md:w-6 md:h-6 animate-spin" />
        ) : step.status === 'locked' ? (
          <Lock className="w-4 h-4 md:w-5 md:h-5" />
        ) : (
          step.number
        )}
      </div>
      <span
        className={cn(
          'hidden md:block text-xs mt-2 font-medium whitespace-nowrap',
          step.status === 'locked' ? 'text-slate-400' : 'text-slate-700'
        )}
      >
        {step.shortLabel}
      </span>
    </button>
  );
}

/**
 * 진행률 계산 (0~100)
 */
export function calculateProgress(steps: WorkflowStepInfo[]): number {
  if (steps.length === 0) return 0;
  const completed = steps.filter((s) => s.status === 'completed').length;
  const inProgress = steps.filter((s) => s.status === 'in_progress').length;
  return Math.round(((completed + inProgress * 0.5) / steps.length) * 100);
}

/**
 * 다음 할 일 단계 찾기
 */
export function findNextStep(steps: WorkflowStepInfo[]): WorkflowStepInfo | null {
  const inProg = steps.find((s) => s.status === 'in_progress');
  if (inProg) return inProg;
  const avail = steps.find((s) => s.status === 'available');
  if (avail) return avail;
  return null;
}
