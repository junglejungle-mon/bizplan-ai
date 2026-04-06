/**
 * AI 인터뷰 질문 은행 — 사업계획서 작성에 필요한 7가지 핵심 질문
 *
 * 출처: NAS skills/16-business-plan-writer/patterns/winning-patterns.md
 *       (실제 선정된 사업계획서 12건 분석 기반)
 *
 * 사용:
 * - AI가 사용자의 회사 자료(documents/extracted_data)를 보고 자동 답안 생성
 * - 사용자는 답안을 검토/편집
 * - 완성된 답안은 사업계획서 자동 작성 시 컨텍스트로 활용
 */

export type InterviewCategory =
  | 'company' // 회사/대표 기본 정보
  | 'problem' // 문제 인식
  | 'solution' // 솔루션
  | 'market' // 시장 분석
  | 'competition' // 경쟁사
  | 'business_model' // BM
  | 'team' // 팀 구성
  | 'financials' // 재무 계획
  | 'roadmap'; // 로드맵

export interface InterviewQuestion {
  id: string;
  category: InterviewCategory;
  /** 사용자에게 보이는 질문 */
  question: string;
  /** 답변 가이드 (placeholder/힌트) */
  hint: string;
  /** 좋은 답변의 예시 (드롭다운으로 보여줄 수 있음) */
  example: string;
  /** AI가 답안 생성 시 참고할 키워드 */
  aiContextKeywords: string[];
  /** 답변의 최소 글자 수 (검증용) */
  minLength: number;
  /** 권장 답변 형식 */
  format: 'short' | 'paragraph' | 'list';
  /** 필수 여부 */
  required: boolean;
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  // ========================================================================
  // 1. 회사/대표 기본 정보
  // ========================================================================
  {
    id: 'q01-company-summary',
    category: 'company',
    question: '회사를 한 문장으로 소개해주세요',
    hint: '"우리는 ___을 위해 ___을 ___로 해결합니다" 형식 추천',
    example:
      '우리는 중소기업 사업계획서 작성의 비효율을 AI 자동 작성으로 해결하는 SaaS 서비스입니다.',
    aiContextKeywords: ['회사명', '비전', '미션', '한 줄 소개', '엘리베이터 피치'],
    minLength: 30,
    format: 'short',
    required: true,
  },
  {
    id: 'q02-founder',
    category: 'team',
    question: '대표자의 핵심 경력은? (학력 + 회사 + 성과)',
    hint: '학력, 이전 회사, 핵심 성과를 1~2줄로',
    example:
      '○○대학교 컴퓨터공학 석사, ○○사 R&D 15년, 특허 4건, 매출 100억 사업 총괄 경험',
    aiContextKeywords: ['대표자', 'CEO', '경력', '학력', '특허', '성과'],
    minLength: 30,
    format: 'short',
    required: true,
  },

  // ========================================================================
  // 2. 문제 인식 (Problem)
  // ========================================================================
  {
    id: 'q03-problem',
    category: 'problem',
    question: '해결하려는 문제는 무엇이고, 시장에서 얼마나 큰 문제인가요?',
    hint: '구체적인 수치(시장 규모, 손실액, 영향받는 사람 수)를 포함하세요',
    example:
      '국내 중소기업 80만개가 매년 사업계획서 작성에 평균 200시간을 투자하지만, 합격률은 5%에 불과합니다. 비효율로 인한 연간 손실이 약 2조원으로 추산됩니다.',
    aiContextKeywords: ['문제', '시장 규모', '손실', 'pain point', '불편', '비효율'],
    minLength: 80,
    format: 'paragraph',
    required: true,
  },

  // ========================================================================
  // 3. 솔루션
  // ========================================================================
  {
    id: 'q04-solution',
    category: 'solution',
    question: '우리 제품/서비스의 핵심 차별점 3가지를 알려주세요',
    hint: '경쟁사 대비 정량적으로 우위인 점 (3배 빠름, 50% 저렴 등)',
    example:
      '1. AI 자동 작성으로 작성 시간 90% 단축 (200시간 → 20시간)\n2. 합격 사업계획서 1만건 학습으로 합격률 30% 향상\n3. 양식 자동 채움으로 별도 편집 작업 불필요',
    aiContextKeywords: ['차별점', '강점', '특징', '기술', 'USP', 'unique'],
    minLength: 80,
    format: 'list',
    required: true,
  },

  // ========================================================================
  // 4. 시장 분석
  // ========================================================================
  {
    id: 'q05-market',
    category: 'market',
    question: 'TAM/SAM/SOM 시장 규모를 알려주세요 (수치 + 출처)',
    hint: 'TAM=전체 시장, SAM=유효 시장, SOM=목표 시장. 각각 금액 + 단위',
    example:
      'TAM: 글로벌 사업계획서 작성 시장 50조원 (Grand View Research)\nSAM: 국내 중소기업 SaaS 시장 5조원 (KISDI)\nSOM: 우리 타깃 30만 중소기업의 5% = 1500억원',
    aiContextKeywords: ['TAM', 'SAM', 'SOM', '시장 규모', '시장 분석', 'CAGR'],
    minLength: 80,
    format: 'paragraph',
    required: true,
  },

  // ========================================================================
  // 5. 경쟁사
  // ========================================================================
  {
    id: 'q06-competition',
    category: 'competition',
    question: '주요 경쟁사 2~3곳과 우리의 차별점을 설명해주세요',
    hint: '경쟁사명 + 그들의 강점/약점 + 우리가 우위인 점',
    example:
      'A사: 전통 컨설팅 방식, 비싼 가격(500만원/건), 우리는 1/10 가격\nB사: AI 사용하지만 합격 데이터 부재, 우리는 1만건 학습\n자사: AI 자동 + 합격 데이터 + 양식 자동 채움 통합',
    aiContextKeywords: ['경쟁사', '비교', '경쟁', '대안', 'competitor'],
    minLength: 80,
    format: 'list',
    required: true,
  },

  // ========================================================================
  // 6. 비즈니스 모델
  // ========================================================================
  {
    id: 'q07-business-model',
    category: 'business_model',
    question: '수익 모델은 어떻게 되나요? (가격, 단위 경제)',
    hint: '월 구독료, 건당 과금, 수수료 등 + 객단가 + 마진',
    example:
      'SaaS 구독: 월 99,000원 (베이직), 299,000원 (프로)\n건당 과금: 사업계획서 1건당 49,000원\nLTV/CAC: 18개월 / 200,000원 = 10x',
    aiContextKeywords: ['수익', '가격', '구독', 'BM', 'pricing', 'ARPU'],
    minLength: 60,
    format: 'paragraph',
    required: true,
  },
];

/**
 * 카테고리별 질문 그룹화
 */
export function groupQuestionsByCategory(): Record<InterviewCategory, InterviewQuestion[]> {
  const result = {} as Record<InterviewCategory, InterviewQuestion[]>;
  for (const q of INTERVIEW_QUESTIONS) {
    if (!result[q.category]) result[q.category] = [];
    result[q.category].push(q);
  }
  return result;
}

/**
 * 카테고리 한글 라벨
 */
export const CATEGORY_LABELS: Record<InterviewCategory, string> = {
  company: '회사 소개',
  problem: '문제 인식',
  solution: '솔루션',
  market: '시장 분석',
  competition: '경쟁사 분석',
  business_model: '비즈니스 모델',
  team: '팀 구성',
  financials: '재무 계획',
  roadmap: '로드맵',
};

/**
 * 답변 객체 (DB 저장용)
 */
export interface InterviewAnswer {
  questionId: string;
  category: InterviewCategory;
  answer: string;
  /** AI 자동 생성 답변인지 사용자 직접 입력인지 */
  source: 'ai_generated' | 'user_input' | 'edited';
  /** 글자 수 */
  length: number;
  /** 답변 시점 */
  answeredAt: string;
}

/**
 * 답변 검증
 */
export function validateAnswer(
  question: InterviewQuestion,
  answer: string
): { valid: boolean; reason?: string } {
  if (!answer || answer.trim().length === 0) {
    if (question.required) {
      return { valid: false, reason: '필수 항목입니다' };
    }
    return { valid: true };
  }

  if (answer.trim().length < question.minLength) {
    return {
      valid: false,
      reason: `최소 ${question.minLength}자 이상 입력해주세요 (현재 ${answer.trim().length}자)`,
    };
  }

  return { valid: true };
}

/**
 * 진행률 계산
 */
export function calculateInterviewProgress(answers: InterviewAnswer[]): {
  total: number;
  answered: number;
  required: number;
  requiredAnswered: number;
  percentage: number;
} {
  const total = INTERVIEW_QUESTIONS.length;
  const required = INTERVIEW_QUESTIONS.filter((q) => q.required).length;
  const answeredIds = new Set(answers.map((a) => a.questionId));
  const answered = answeredIds.size;
  const requiredAnswered = INTERVIEW_QUESTIONS.filter(
    (q) => q.required && answeredIds.has(q.id)
  ).length;

  return {
    total,
    answered,
    required,
    requiredAnswered,
    percentage: required > 0 ? Math.round((requiredAnswered / required) * 100) : 0,
  };
}
