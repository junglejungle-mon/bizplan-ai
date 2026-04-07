/**
 * AI 인터뷰 폼 — 7개 표준 질문 + AI 자동 답안 + 사용자 편집
 *
 * 흐름:
 * 1. AI가 자료를 보고 7개 질문에 자동 답안 생성 (서버에서 미리 호출)
 * 2. 사용자에게 답안을 보여주고 편집 가능
 * 3. 검증 통과한 답변만 저장
 * 4. 완료 시 사업계획서 작성으로 이동
 */
'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import {
  INTERVIEW_QUESTIONS,
  CATEGORY_LABELS,
  validateAnswer,
  type InterviewAnswer,
  type InterviewQuestion,
} from '@/lib/interview/question-bank';

interface InterviewFormProps {
  /** AI가 미리 생성한 초기 답변 (없으면 빈 객체) */
  initialAnswers?: Record<string, string>;
  /** 답변 저장 함수 (서버 액션) */
  onSave: (answers: InterviewAnswer[]) => Promise<{ ok: boolean; error?: string }>;
  /** AI 자동 생성 트리거 */
  onGenerateAI?: () => Promise<Record<string, string>>;
  /** 저장 후 이동할 경로 */
  nextPath?: string;
}

export function InterviewForm({
  initialAnswers = {},
  onSave,
  onGenerateAI,
  nextPath = '/workflow',
}: InterviewFormProps) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, string>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  // 어떤 답변이 AI가 생성한 것인지 추적 (편집되면 'edited'로 변경)
  const [sourceMap, setSourceMap] = useState<Record<string, 'ai_generated' | 'user_input' | 'edited'>>(
    () => {
      const m: Record<string, 'ai_generated' | 'user_input' | 'edited'> = {};
      for (const id of Object.keys(initialAnswers)) {
        m[id] = 'ai_generated';
      }
      return m;
    }
  );

  // ============================================================
  // 답변 변경 핸들러
  // ============================================================
  function handleChange(question: InterviewQuestion, value: string) {
    setAnswers((prev) => ({ ...prev, [question.id]: value }));

    // AI 생성 답변을 편집했으면 'edited'로 변경
    setSourceMap((prev) => {
      if (prev[question.id] === 'ai_generated') {
        return { ...prev, [question.id]: 'edited' };
      }
      if (!prev[question.id]) {
        return { ...prev, [question.id]: 'user_input' };
      }
      return prev;
    });

    // 실시간 검증
    const validation = validateAnswer(question, value);
    setErrors((prev) => {
      const next = { ...prev };
      if (!validation.valid && validation.reason) {
        next[question.id] = validation.reason;
      } else {
        delete next[question.id];
      }
      return next;
    });
  }

  // ============================================================
  // AI 자동 생성 트리거
  // ============================================================
  async function handleGenerateAI() {
    if (!onGenerateAI) return;
    setIsGenerating(true);
    try {
      const result = await onGenerateAI();
      setAnswers(result);
      const newSourceMap: Record<string, 'ai_generated' | 'user_input' | 'edited'> = {};
      for (const id of Object.keys(result)) {
        newSourceMap[id] = 'ai_generated';
      }
      setSourceMap(newSourceMap);
      setSaveMessage({ type: 'success', text: 'AI가 답변을 자동 생성했습니다. 검토 후 저장하세요.' });
    } catch (e) {
      setSaveMessage({
        type: 'error',
        text: `AI 생성 실패: ${e instanceof Error ? e.message : 'unknown'}`,
      });
    } finally {
      setIsGenerating(false);
    }
  }

  // ============================================================
  // 저장 핸들러
  // ============================================================
  async function handleSave() {
    // 1. 모든 필수 항목 검증
    const newErrors: Record<string, string> = {};
    for (const q of INTERVIEW_QUESTIONS) {
      const v = validateAnswer(q, answers[q.id] || '');
      if (!v.valid && v.reason) {
        newErrors[q.id] = v.reason;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setSaveMessage({
        type: 'error',
        text: `${Object.keys(newErrors).length}개 항목을 확인해주세요`,
      });
      return;
    }

    // 2. InterviewAnswer 객체로 변환
    const list: InterviewAnswer[] = INTERVIEW_QUESTIONS.filter((q) => answers[q.id]).map(
      (q) => ({
        questionId: q.id,
        category: q.category,
        answer: answers[q.id].trim(),
        source: sourceMap[q.id] || 'user_input',
        length: answers[q.id].trim().length,
        answeredAt: new Date().toISOString(),
      })
    );

    // 3. 서버 저장
    startTransition(async () => {
      const result = await onSave(list);
      if (result.ok) {
        setSaveMessage({ type: 'success', text: '인터뷰 답변이 저장되었습니다!' });
        setTimeout(() => router.push(nextPath), 800);
      } else {
        setSaveMessage({
          type: 'error',
          text: result.error || '저장 실패',
        });
      }
    });
  }

  // ============================================================
  // 진행률
  // ============================================================
  const filledCount = INTERVIEW_QUESTIONS.filter(
    (q) => answers[q.id] && answers[q.id].trim().length >= q.minLength
  ).length;
  const progress = Math.round((filledCount / INTERVIEW_QUESTIONS.length) * 100);

  // ============================================================
  // 렌더
  // ============================================================
  return (
    <div className="space-y-6">
      {/* 헤더 + 진행률 + AI 자동 생성 */}
      <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50">
        <CardContent className="p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-blue-700 text-sm font-medium">
                <Sparkles className="w-4 h-4" />
                AI 인터뷰
              </div>
              <h2 className="text-lg md:text-xl font-bold mt-1 text-slate-900">
                7개 핵심 질문에 답해주세요
              </h2>
              <p className="text-xs md:text-sm text-slate-600 mt-1">
                답변은 사업계획서와 IR PPT 자동 작성에 사용됩니다
              </p>
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                  <span>완료 진행률</span>
                  <span className="font-semibold">
                    {filledCount}/{INTERVIEW_QUESTIONS.length} ({progress}%)
                  </span>
                </div>
                <div className="h-2 bg-white rounded-full overflow-hidden border border-blue-100">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            {onGenerateAI && (
              <Button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                variant="outline"
                className="bg-white"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    생성 중...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    AI 자동 답안 생성
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 메시지 */}
      {saveMessage && (
        <div
          className={cn(
            'flex items-center gap-2 px-4 py-3 rounded-md text-sm',
            saveMessage.type === 'success' && 'bg-green-50 text-green-800 border border-green-200',
            saveMessage.type === 'error' && 'bg-red-50 text-red-800 border border-red-200'
          )}
        >
          {saveMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* 질문 카드들 */}
      {INTERVIEW_QUESTIONS.map((q, idx) => {
        const value = answers[q.id] || '';
        const error = errors[q.id];
        const source = sourceMap[q.id];
        const isFilled = value.trim().length >= q.minLength;

        return (
          <Card
            key={q.id}
            className={cn(
              'transition-all',
              isFilled && 'border-green-300',
              error && 'border-red-300'
            )}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                    <span>질문 {idx + 1}/{INTERVIEW_QUESTIONS.length}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {CATEGORY_LABELS[q.category]}
                    </Badge>
                    {q.required && (
                      <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700">
                        필수
                      </Badge>
                    )}
                    {source === 'ai_generated' && (
                      <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                        <Sparkles className="w-3 h-3 mr-1" />
                        AI 생성
                      </Badge>
                    )}
                    {source === 'edited' && (
                      <Badge variant="secondary" className="text-[10px] bg-amber-50 text-amber-700">
                        <Edit3 className="w-3 h-3 mr-1" />
                        편집됨
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-base md:text-lg">{q.question}</CardTitle>
                  <p className="text-xs text-slate-500 mt-1">💡 {q.hint}</p>
                </div>
                {isFilled && <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <Textarea
                value={value}
                onChange={(e) => handleChange(q, e.target.value)}
                placeholder={q.example}
                rows={q.format === 'paragraph' ? 5 : q.format === 'list' ? 4 : 3}
                className={cn(error && 'border-red-300 focus:border-red-500')}
              />
              <div className="flex items-center justify-between text-xs">
                <span className={cn('text-slate-500', error && 'text-red-600')}>
                  {error || `${value.trim().length}/${q.minLength}자`}
                </span>
                <details className="text-slate-500">
                  <summary className="cursor-pointer hover:text-blue-600">예시 보기</summary>
                  <div className="mt-2 p-2 bg-slate-50 rounded text-xs text-slate-600 whitespace-pre-line">
                    {q.example}
                  </div>
                </details>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* 저장 버튼 */}
      <div className="sticky bottom-4 bg-white border border-slate-200 rounded-lg shadow-lg p-4 flex items-center justify-between gap-4">
        <div className="text-sm text-slate-600">
          {filledCount === INTERVIEW_QUESTIONS.length
            ? '✅ 모든 질문 완료! 저장하세요'
            : `${INTERVIEW_QUESTIONS.length - filledCount}개 질문 남았습니다`}
        </div>
        <Button
          onClick={handleSave}
          disabled={isPending || filledCount === 0}
          size="lg"
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              저장 중...
            </>
          ) : (
            '저장하고 다음으로'
          )}
        </Button>
      </div>
    </div>
  );
}
