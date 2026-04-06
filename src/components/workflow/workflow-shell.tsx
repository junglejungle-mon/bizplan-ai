/**
 * 워크플로우 셸 — 상단 진행률 + 스테퍼 + 카드 그리드
 */
'use client';

import { useState } from 'react';
import { Sparkles, ArrowRight, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  WorkflowStepper,
  calculateProgress,
  findNextStep,
  type WorkflowStepInfo,
  type WorkflowStepKey,
} from './workflow-stepper';
import { StepCard, type StepCardProps } from './step-card';

export interface WorkflowShellProps {
  companyName: string;
  steps: WorkflowStepInfo[];
  cardProps: Record<WorkflowStepKey, Omit<StepCardProps, 'status' | 'number' | 'stepKey'>>;
  initialActiveStep?: WorkflowStepKey;
}

export function WorkflowShell({
  companyName,
  steps,
  cardProps,
  initialActiveStep,
}: WorkflowShellProps) {
  const next = findNextStep(steps);
  const [activeStep, setActiveStep] = useState<WorkflowStepKey>(
    initialActiveStep || next?.key || steps[0].key
  );

  const progress = calculateProgress(steps);
  const nextStep = findNextStep(steps);

  return (
    <div className="space-y-6">
      {/* 상단 진행률 + CTA */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-blue-700 text-xs md:text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                {companyName}님의 사업계획서 작성 워크플로우
              </div>
              <h1 className="text-xl md:text-2xl font-bold mt-1 text-slate-900">
                {progress === 100
                  ? '🎉 모든 단계 완료! 결과를 확인하세요'
                  : nextStep
                    ? `다음 할 일: ${nextStep.label}`
                    : '워크플로우를 시작하세요'}
              </h1>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>전체 진행률</span>
                  <span className="font-semibold">{progress}%</span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-blue-100">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {nextStep && (
              <Button
                size="lg"
                className="md:self-end bg-blue-600 hover:bg-blue-700"
                onClick={() => setActiveStep(nextStep.key)}
              >
                {progress === 0 ? '시작하기' : '계속하기'}
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 스테퍼 */}
      <Card>
        <CardContent className="p-5 md:p-6">
          <WorkflowStepper
            steps={steps}
            activeStep={activeStep}
            onStepClick={setActiveStep}
          />
        </CardContent>
      </Card>

      {/* 단계별 카드 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 pt-3">
        {steps.map((step) => {
          const props = cardProps[step.key];
          return (
            <StepCard
              key={step.key}
              stepKey={step.key}
              number={step.number}
              status={step.status}
              isFocused={step.key === activeStep}
              {...props}
            />
          );
        })}
      </div>

      {/* 하단 도움말 */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
        <div>💡 모든 단계는 언제든 다시 편집할 수 있습니다</div>
        <Button variant="ghost" size="sm" className="text-slate-500">
          <RefreshCw className="w-3 h-3 mr-1" />
          전체 새로고침
        </Button>
      </div>
    </div>
  );
}
