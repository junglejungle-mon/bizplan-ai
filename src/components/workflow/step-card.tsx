/**
 * 단계 카드 — 워크플로우의 각 단계를 표시하는 액션 카드
 */
'use client';

import Link from 'next/link';
import { ArrowRight, Lock, Check, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import type { WorkflowStepStatus, WorkflowStepKey } from './workflow-stepper';

export interface StepCardProps {
  stepKey: WorkflowStepKey;
  number: number;
  title: string;
  description: string;
  status: WorkflowStepStatus;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  secondaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  summary?: string;
  metrics?: Array<{ label: string; value: string; color?: 'default' | 'success' | 'warning' }>;
  isFocused?: boolean;
}

export function StepCard(props: StepCardProps) {
  const {
    number,
    title,
    description,
    status,
    primaryAction,
    secondaryAction,
    summary,
    metrics,
    isFocused,
  } = props;

  const isLocked = status === 'locked';
  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';

  return (
    <Card
      className={cn(
        'relative transition-all border',
        isLocked && 'opacity-60 border-slate-200',
        isCompleted && 'border-green-300 bg-green-50/30',
        isInProgress && 'border-blue-400 shadow-lg ring-2 ring-blue-100',
        isFocused && !isLocked && !isCompleted && 'border-blue-300 shadow-md'
      )}
    >
      <div className="absolute -top-3 -left-3">
        <div
          className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm border-2',
            isCompleted && 'bg-green-500 border-green-600 text-white',
            isInProgress && 'bg-blue-500 border-blue-600 text-white',
            !isCompleted && !isInProgress && !isLocked && 'bg-white border-blue-400 text-blue-600',
            isLocked && 'bg-slate-100 border-slate-300 text-slate-400'
          )}
        >
          {isCompleted ? (
            <Check className="w-4 h-4" />
          ) : isInProgress ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isLocked ? (
            <Lock className="w-3.5 h-3.5" />
          ) : (
            number
          )}
        </div>
      </div>

      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <CardTitle className="text-base md:text-lg">{title}</CardTitle>
            <CardDescription className="text-xs md:text-sm mt-1">
              {description}
            </CardDescription>
          </div>
          <StatusBadge status={status} />
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {summary && !isLocked && (
          <div className="text-sm text-slate-700 bg-slate-50 rounded-md px-3 py-2">
            {summary}
          </div>
        )}

        {metrics && metrics.length > 0 && !isLocked && (
          <div className="grid grid-cols-3 gap-2">
            {metrics.slice(0, 3).map((m, i) => (
              <div
                key={i}
                className={cn(
                  'rounded-md border p-2 text-center',
                  m.color === 'success' && 'bg-green-50 border-green-200',
                  m.color === 'warning' && 'bg-amber-50 border-amber-200',
                  (!m.color || m.color === 'default') && 'bg-slate-50 border-slate-200'
                )}
              >
                <div
                  className={cn(
                    'text-base md:text-lg font-bold',
                    m.color === 'success' && 'text-green-700',
                    m.color === 'warning' && 'text-amber-700',
                    (!m.color || m.color === 'default') && 'text-slate-900'
                  )}
                >
                  {m.value}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{m.label}</div>
              </div>
            ))}
          </div>
        )}

        {!isLocked && (primaryAction || secondaryAction) && (
          <div className="flex gap-2 pt-1">
            {primaryAction && (
              <ActionButton
                action={primaryAction}
                variant={isCompleted ? 'outline' : 'default'}
                primary
              />
            )}
            {secondaryAction && (
              <ActionButton action={secondaryAction} variant="outline" />
            )}
          </div>
        )}

        {isLocked && (
          <div className="text-xs text-slate-500 italic">
            이전 단계를 먼저 완료해주세요
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: WorkflowStepStatus }) {
  const map: Record<WorkflowStepStatus, { label: string; className: string }> = {
    locked: { label: '잠김', className: 'bg-slate-100 text-slate-500' },
    available: { label: '시작 가능', className: 'bg-blue-100 text-blue-700' },
    in_progress: { label: '진행 중', className: 'bg-amber-100 text-amber-700' },
    completed: { label: '완료', className: 'bg-green-100 text-green-700' },
  };
  const { label, className } = map[status];
  return (
    <Badge variant="secondary" className={cn('text-[10px] font-medium', className)}>
      {label}
    </Badge>
  );
}

function ActionButton({
  action,
  variant = 'default',
  primary = false,
}: {
  action: { label: string; href?: string; onClick?: () => void };
  variant?: 'default' | 'outline';
  primary?: boolean;
}) {
  // Button이 asChild를 지원하지 않으므로 Link를 사용 시엔 Button을 Link 안에 넣지 않고
  // Link 자체를 Button 스타일로 렌더 (w/ Button 직접 사용 X)
  if (action.href) {
    return (
      <Link
        href={action.href}
        className={cn(
          'inline-flex items-center justify-center gap-1 rounded-md text-sm font-medium transition-colors',
          'h-9 px-3 py-2',
          primary && 'flex-1',
          variant === 'default' &&
            'bg-blue-600 text-white hover:bg-blue-700',
          variant === 'outline' &&
            'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
        )}
      >
        {action.label}
        {primary && <ArrowRight className="w-3.5 h-3.5" />}
      </Link>
    );
  }

  return (
    <Button
      size="sm"
      variant={variant}
      onClick={action.onClick}
      className={cn(primary && 'flex-1')}
    >
      {action.label}
      {primary && <ArrowRight className="w-3.5 h-3.5 ml-1" />}
    </Button>
  );
}
