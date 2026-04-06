/**
 * AI 자동 답안 생성기
 *
 * 사용자가 업로드한 회사 자료를 기반으로 AI가 7가지 인터뷰 질문에 자동 답안 생성.
 * 사용자는 검토/수정만 하면 되므로 작성 시간 90% 단축.
 *
 * 동작:
 * 1. 회사 정보 + 업로드된 문서의 추출 데이터 수집
 * 2. 각 질문별로 callAI() 호출 (개별 vs 일괄 — 일괄이 더 빠름)
 * 3. AI 응답을 답변 형식으로 정리
 * 4. validateAnswer로 검증
 *
 * 사용:
 *   import { generateAutoAnswers } from '@/lib/interview/auto-answer';
 *   const answers = await generateAutoAnswers({ company, documents });
 */
import { callAI } from '@/lib/ai';
import {
  INTERVIEW_QUESTIONS,
  validateAnswer,
  type InterviewAnswer,
  type InterviewQuestion,
} from './question-bank';

export interface AutoAnswerInput {
  company: {
    name: string;
    industry?: string;
    business_summary?: string;
    employee_count?: number;
    founded_year?: number;
  };
  /** 업로드된 회사 문서의 추출 데이터 */
  documents: Array<{
    document_type: string;
    extracted_data?: Record<string, unknown> | null;
    summary?: string;
  }>;
  /** verbose 로그 */
  verbose?: boolean;
}

export interface AutoAnswerResult {
  answers: InterviewAnswer[];
  /** 답안 생성 실패한 질문 ID */
  failedQuestionIds: string[];
  /** 검증 실패한 질문 ID */
  invalidQuestionIds: string[];
  /** 총 소요 시간 (ms) */
  durationMs: number;
}

/**
 * 메인 진입점 — 7개 질문에 대한 자동 답안 생성
 */
export async function generateAutoAnswers(
  input: AutoAnswerInput
): Promise<AutoAnswerResult> {
  const start = Date.now();
  const { company, documents, verbose = false } = input;

  // 1. 컨텍스트 빌드 (회사 정보 + 문서 요약)
  const companyContext = buildCompanyContext(company);
  const documentContext = buildDocumentContext(documents);

  if (verbose) {
    console.log('[auto-answer] 컨텍스트:', {
      companyLength: companyContext.length,
      docsLength: documentContext.length,
      docs: documents.length,
    });
  }

  // 2. 일괄 답안 생성 (1번의 AI 호출로 7개 질문 모두)
  const prompt = buildBatchPrompt(companyContext, documentContext);

  let parsed: Record<string, string> = {};
  try {
    const result = await callAI(prompt, {
      model: 'sonnet',
      context: 'interview-auto-answer',
      timeoutMs: 120_000,
    });

    parsed = parseAnswers(result.output);

    if (verbose) {
      console.log('[auto-answer] 파싱된 답안 키:', Object.keys(parsed));
    }
  } catch (e) {
    if (verbose) {
      console.error(
        '[auto-answer] AI 호출 실패:',
        e instanceof Error ? e.message : 'unknown'
      );
    }
    return {
      answers: [],
      failedQuestionIds: INTERVIEW_QUESTIONS.map((q) => q.id),
      invalidQuestionIds: [],
      durationMs: Date.now() - start,
    };
  }

  // 3. 답안을 InterviewAnswer 객체로 변환 + 검증
  const answers: InterviewAnswer[] = [];
  const failedQuestionIds: string[] = [];
  const invalidQuestionIds: string[] = [];

  for (const q of INTERVIEW_QUESTIONS) {
    const text = parsed[q.id];
    if (!text || text.trim().length === 0) {
      failedQuestionIds.push(q.id);
      continue;
    }

    const validation = validateAnswer(q, text);
    if (!validation.valid) {
      invalidQuestionIds.push(q.id);
      // 검증 실패해도 답변은 저장 (사용자가 수정 가능)
    }

    answers.push({
      questionId: q.id,
      category: q.category,
      answer: text.trim(),
      source: 'ai_generated',
      length: text.trim().length,
      answeredAt: new Date().toISOString(),
    });
  }

  return {
    answers,
    failedQuestionIds,
    invalidQuestionIds,
    durationMs: Date.now() - start,
  };
}

// ============================================================================
// 헬퍼: 컨텍스트 빌드
// ============================================================================

function buildCompanyContext(company: AutoAnswerInput['company']): string {
  const parts: string[] = [`회사명: ${company.name}`];
  if (company.industry) parts.push(`업종: ${company.industry}`);
  if (company.business_summary) parts.push(`사업 요약: ${company.business_summary}`);
  if (company.employee_count) parts.push(`직원 수: ${company.employee_count}명`);
  if (company.founded_year) parts.push(`설립: ${company.founded_year}년`);
  return parts.join('\n');
}

function buildDocumentContext(documents: AutoAnswerInput['documents']): string {
  if (documents.length === 0) return '(업로드된 문서 없음)';

  const lines: string[] = [];
  for (const doc of documents.slice(0, 10)) {
    lines.push(`[${doc.document_type}]`);
    if (doc.summary) {
      lines.push(`요약: ${doc.summary.slice(0, 300)}`);
    }
    if (doc.extracted_data) {
      // 추출 데이터의 핵심 키만 포함 (너무 길어지지 않게)
      const keys = Object.keys(doc.extracted_data).slice(0, 8);
      for (const k of keys) {
        const v = doc.extracted_data[k];
        const vStr =
          typeof v === 'string'
            ? v.slice(0, 200)
            : JSON.stringify(v).slice(0, 200);
        lines.push(`- ${k}: ${vStr}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ============================================================================
// 헬퍼: 일괄 프롬프트 빌드
// ============================================================================

function buildBatchPrompt(companyContext: string, documentContext: string): string {
  const questionList = INTERVIEW_QUESTIONS.map(
    (q, i) =>
      `${i + 1}. [${q.id}] ${q.question}\n   힌트: ${q.hint}\n   최소 ${q.minLength}자, 형식: ${q.format}`
  ).join('\n\n');

  return `당신은 사업계획서 전문가입니다. 아래 회사의 정보를 바탕으로 7가지 인터뷰 질문에 대한 답변을 생성하세요.

[회사 정보]
${companyContext}

[업로드된 자료]
${documentContext}

[질문 목록]
${questionList}

[엄격한 출력 규칙]
1. 반드시 JSON 형식으로 출력 (마크다운 코드 블록 없이)
2. 키는 질문 ID (q01-company-summary, q02-founder, ...), 값은 답변 문자열
3. 모든 답변은 구체적인 수치/사실 포함 (추측은 명시)
4. 회사 정보가 부족하면 일반적으로 합리적인 추정값 사용 (괄호로 "추정" 표시)
5. 각 답변은 해당 질문의 minLength를 충족
6. JSON 외의 설명/주석 금지

[출력 형식]
{
  "q01-company-summary": "...",
  "q02-founder": "...",
  "q03-problem": "...",
  "q04-solution": "...",
  "q05-market": "...",
  "q06-competition": "...",
  "q07-business-model": "..."
}`;
}

// ============================================================================
// 헬퍼: AI 응답 파싱
// ============================================================================

function parseAnswers(output: string): Record<string, string> {
  // 1. 코드 블록 제거
  const cleaned = output.replace(/```json\n?|\n?```/g, '').trim();

  // 2. 첫 { ~ 마지막 } 추출
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    return {};
  }

  const jsonText = cleaned.slice(firstBrace, lastBrace + 1);

  try {
    const parsed = JSON.parse(jsonText) as Record<string, unknown>;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'string') {
        result[k] = v;
      } else {
        result[k] = JSON.stringify(v);
      }
    }
    return result;
  } catch {
    return {};
  }
}

// ============================================================================
// 단일 질문 답안 생성 (보강용 — 일괄 실패 시 개별 재시도)
// ============================================================================

export async function generateSingleAnswer(
  question: InterviewQuestion,
  context: { company: AutoAnswerInput['company']; documents: AutoAnswerInput['documents'] }
): Promise<string | null> {
  const companyCtx = buildCompanyContext(context.company);
  const docCtx = buildDocumentContext(context.documents);

  const prompt = `당신은 사업계획서 전문가입니다.

[회사 정보]
${companyCtx}

[업로드된 자료]
${docCtx}

[질문]
${question.question}

[답변 가이드]
${question.hint}

[제약]
- 최소 ${question.minLength}자
- 구체적 수치 포함
- 한국어
- JSON/마크다운 금지, 답변만 출력`;

  try {
    const result = await callAI(prompt, {
      model: 'sonnet',
      context: `interview-single-${question.id}`,
      timeoutMs: 60_000,
    });
    return result.output.trim();
  } catch {
    return null;
  }
}
