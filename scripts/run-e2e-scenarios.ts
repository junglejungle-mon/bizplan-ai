#!/usr/bin/env npx tsx
/**
 * End-to-End 사용자 시나리오 검증
 *
 * 5개 가상 사용자가 a-z 워크플로우를 거치며 각 단계 모듈이 정상 동작하는지 확인.
 * callAI 호출 없이 순수 함수만 실행 (오프라인 검증).
 *
 * 사용:
 *   npx tsx scripts/run-e2e-scenarios.ts
 */
import {
  INTERVIEW_QUESTIONS,
  CATEGORY_LABELS,
  validateAnswer,
  calculateInterviewProgress,
  groupQuestionsByCategory,
  type InterviewAnswer,
} from '../src/lib/interview/question-bank';
import {
  diagnoseAndPlan,
  selectPatternForContent,
} from '../src/lib/pipeline/infographic/pattern-selector';
import {
  getPatternForSlide,
  resolveIndustryPalette,
  listAllPatterns,
} from '../src/lib/pipeline/infographic/pattern-library';
import {
  getSkeletonForSection,
  buildTamSamSomPreset,
} from '../src/lib/pipeline/infographic/chart-presets';
import { getPatternGuideForGenerator } from '../src/lib/pipeline/ppt-harness-v2';

interface Scenario {
  id: string;
  name: string;
  industry: string;
  companyName: string;
  /** 인터뷰 답변 (질문 ID → 답변) */
  answers: Record<string, string>;
  /** 사업계획서 슬라이드 (Generator가 만들었다고 가정) */
  slides: Array<{
    slide_type: string;
    content: {
      headline?: string;
      subtext?: string;
      bullets?: string[];
      stats?: Array<{ value: string; label: string }>;
      chart?: { type: string; title?: string; data?: unknown };
    };
  }>;
  expected: {
    /** 인터뷰 진행률 (필수 질문 기준) */
    interviewProgress: number;
    /** 약한 슬라이드 수 */
    weakSlideCount: number;
  };
}

// ============================================================================
// 5개 가상 시나리오 (모든 답변이 minLength 충족하도록 충분히 길게)
// ============================================================================
const scenarios: Scenario[] = [
  // ----- 시나리오 1: 완벽한 사용자 (모든 답변 + 풍부한 슬라이드) -----
  {
    id: 'perfect',
    name: '완벽한 사용자 (AI 회사)',
    industry: 'IT/AI',
    companyName: '비즈플랜AI',
    answers: {
      'q01-company-summary':
        '우리는 중소기업 사업계획서 작성의 비효율을 AI 자동 작성으로 해결하는 한국형 SaaS 서비스이며 합격률을 6배 높이는 것이 목표입니다.',
      'q02-founder':
        '대표자: 서울대학교 컴퓨터공학과 석사, 네이버 R&D 12년, 특허 5건 보유, 매출 100억원 사업 총괄 경험',
      'q03-problem':
        '국내 중소기업 80만개가 매년 사업계획서 작성에 평균 200시간을 투자하지만, 합격률은 5% 수준에 불과합니다. 전문 컨설팅은 건당 500만원으로 비싸고 품질 편차도 크며, 비효율로 인한 연간 손실액이 약 2조원으로 추산됩니다.',
      'q04-solution':
        '1. AI 자동 작성으로 작성 시간 200시간을 20시간으로 90% 단축\n2. 합격 사업계획서 1만건 학습으로 합격률을 5%에서 30%로 6배 향상\n3. HWPX 양식 자동 채움으로 별도 편집 작업 불필요',
      'q05-market':
        'TAM: 글로벌 사업계획서 작성 시장 50조원 (Grand View Research 2024)\nSAM: 국내 중소기업 SaaS 시장 5조원 (KISDI 2024)\nSOM: 우리 타깃 30만 중소기업의 5% = 1500억원, CAGR 12% 성장',
      'q06-competition':
        'A사(전통 컨설팅): 건당 500만원, 인력 의존, 우리는 1/100 가격\nB사(AI 사용): 합격 데이터 부재, 우리는 1만건 학습\n자사: AI 자동 + 합격 데이터 + 양식 자동 채움 통합 패키지',
      'q07-business-model':
        'SaaS 구독: 월 99,000원(베이직), 299,000원(프로) / 건당 과금: 사업계획서 1건당 49,000원 / LTV 200만원, CAC 20만원, LTV/CAC 비율 10x',
    },
    slides: [
      {
        slide_type: 'overview',
        content: {
          headline: '중소기업 사업계획서, AI가 90% 자동화',
          subtext: '20시간이면 합격률 6배 높이는 사업계획서 완성',
          stats: [
            { value: '90%', label: '시간 단축' },
            { value: '6x', label: '합격률' },
            { value: '49,000원', label: '건당 가격' },
          ],
        },
      },
      {
        slide_type: 'market',
        content: {
          headline: '50조 시장의 5%를 노립니다',
          stats: [
            { value: '50조', label: 'TAM' },
            { value: '5조', label: 'SAM' },
            { value: '1500억', label: 'SOM' },
          ],
          chart: {
            type: 'tam_sam_som',
            title: '시장 규모',
            data: { tam: { value: '50조', label: 'TAM' } },
          },
        },
      },
    ],
    expected: { interviewProgress: 100, weakSlideCount: 0 },
  },

  // ----- 시나리오 2: 완전 빈 사용자 -----
  {
    id: 'empty',
    name: '완전 빈 사용자',
    industry: '',
    companyName: '미정',
    answers: {},
    slides: [
      { slide_type: 'overview', content: { headline: '회사' } },
      { slide_type: 'market', content: { headline: '시장' } },
      { slide_type: 'problem', content: {} },
    ],
    expected: { interviewProgress: 0, weakSlideCount: 3 },
  },

  // ----- 시나리오 3: 부분 입력 (3개 필수 답변만, 모두 minLength 충족) -----
  {
    id: 'partial',
    name: '부분 입력 (3개)',
    industry: '제조업',
    companyName: '메이커즈',
    answers: {
      'q01-company-summary':
        '우리는 친환경 식물성 포장재를 생산하는 제조 스타트업이며 일회용 플라스틱을 대체합니다.',
      'q02-founder':
        '대표자: KAIST 화학공학 박사, 코오롱인더스트리 R&D 8년 경력, 친환경 소재 특허 3건 보유',
      'q03-problem':
        '국내 일회용 플라스틱 폐기물이 연간 728만톤 발생하지만 재활용률은 23%에 불과합니다. 환경 비용은 연간 5조원으로 추산되며, 미세플라스틱 문제까지 더해지면 사회적 비용이 더 큽니다.',
    },
    slides: [
      {
        slide_type: 'overview',
        content: { headline: '친환경 포장재 제조', bullets: ['소재', '생산', '판매'] },
      },
    ],
    // 3개 필수 답변 / 7개 = 약 43%
    expected: { interviewProgress: 42, weakSlideCount: 1 },
  },

  // ----- 시나리오 4: 바이오 회사 (모든 단계 + 차트) -----
  {
    id: 'bio',
    name: '바이오 회사 (산업 팔레트 검증)',
    industry: '바이오/의료',
    companyName: '바이오테크',
    answers: {
      'q01-company-summary':
        '우리는 차세대 면역항암제를 AI 기반으로 개발하는 바이오테크 회사이며 환자 매칭 정확도가 핵심 차별점입니다.',
      'q02-founder':
        '대표자: 서울대학교 의대 졸업, 화이자 R&D 10년, 국제 학술논문 30편, 면역항암제 특허 8건',
      'q03-problem':
        '면역항암제 시장은 1500억 달러 규모이나 효과는 30% 환자에게만 한정되어 있습니다. 70% 환자가 효과 없는 치료를 받고 부작용만 겪으며, 의료비 손실이 연 500억 달러에 달합니다.',
      'q04-solution':
        '1. AI 기반 환자 유전자 매칭으로 효과 있는 환자를 사전 선별\n2. 신규 타깃 단백질 발굴로 기존 약 미반응 환자 공략\n3. 임상 1상 진행 중, 2026년 임상 2상 진입 예정',
      'q05-market':
        'TAM: 면역항암제 1500억 달러 (Statista 2024)\nSAM: AI 기반 환자 매칭 500억 달러\nSOM: 우리 타깃 50억 달러, CAGR 12% 성장 중',
      'q06-competition':
        'BMS(1세대 면역항암제): 효과 30%, 부작용 큼\nMerck(2세대): 효과 35%, 가격 비쌈\n자사(3세대 + AI): 효과 60% 목표, AI 매칭으로 사전 선별',
      'q07-business-model':
        '라이선스 + 마일스톤 + 로열티 모델. 1차 마일스톤 100억원, 임상 2상 통과 시 500억원, 로열티 매출의 8%, 빅파마 파트너십 진행 중',
    },
    slides: [
      {
        slide_type: 'market',
        content: {
          headline: '1500억$ 면역항암제 시장에 진입',
          stats: [
            { value: '1500억$', label: 'TAM' },
            { value: '500억$', label: 'SAM' },
            { value: '50억$', label: 'SOM' },
          ],
          chart: { type: 'tam_sam_som', data: {} },
        },
      },
    ],
    expected: { interviewProgress: 100, weakSlideCount: 0 },
  },

  // ----- 시나리오 5: 검증 실패 케이스 (너무 짧은 답변) -----
  {
    id: 'invalid',
    name: '검증 실패 (너무 짧은 답변)',
    industry: 'IT',
    companyName: '쇼트',
    answers: {
      'q01-company-summary': 'AI 회사',
      'q02-founder': '나',
      'q03-problem': '문제 있음',
    },
    slides: [],
    expected: { interviewProgress: 0, weakSlideCount: 0 },
  },
];

// ============================================================================
// 검증 로직
// ============================================================================

interface ScenarioResult {
  scenarioId: string;
  scenarioName: string;
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; reason?: string }>;
}

function runScenario(s: Scenario): ScenarioResult {
  const checks: Array<{ name: string; passed: boolean; reason?: string }> = [];

  // 1. 산업 팔레트 결정
  const palette = resolveIndustryPalette(s.industry);
  checks.push({
    name: `산업 팔레트 (${s.industry || '기본'})`,
    passed: !!palette.primary,
    reason: !palette.primary ? 'palette null' : undefined,
  });

  // 2. 인터뷰 답변 검증
  let validCount = 0;
  for (const q of INTERVIEW_QUESTIONS) {
    const ans = s.answers[q.id];
    if (ans) {
      const v = validateAnswer(q, ans);
      if (v.valid) validCount++;
    }
  }

  // 3. 인터뷰 진행률 (필수 질문만 기준)
  const answerList: InterviewAnswer[] = Object.entries(s.answers)
    .filter(([qid, ans]) => {
      const q = INTERVIEW_QUESTIONS.find((x) => x.id === qid);
      if (!q) return false;
      return validateAnswer(q, ans).valid;
    })
    .map(([qid, ans]) => {
      const q = INTERVIEW_QUESTIONS.find((x) => x.id === qid)!;
      return {
        questionId: qid,
        category: q.category,
        answer: ans,
        source: 'user_input' as const,
        length: ans.length,
        answeredAt: new Date().toISOString(),
      };
    });

  const progress = calculateInterviewProgress(answerList);
  checks.push({
    name: `인터뷰 진행률 (예상 ${s.expected.interviewProgress}%)`,
    passed: Math.abs(progress.percentage - s.expected.interviewProgress) <= 20,
    reason: `실제 ${progress.percentage}% (유효 답변 ${validCount}/${INTERVIEW_QUESTIONS.length})`,
  });

  // 4. 슬라이드 약점 진단
  let weakCount = 0;
  for (const slide of s.slides) {
    const result = diagnoseAndPlan(slide);
    const isWeak =
      result.actions.length > 0 &&
      result.actions.some((a) => a.priority <= 2);
    if (isWeak) weakCount++;
  }

  checks.push({
    name: `약한 슬라이드 수 (예상 ${s.expected.weakSlideCount})`,
    passed: weakCount === s.expected.weakSlideCount,
    reason: `실제 ${weakCount}`,
  });

  // 5. 패턴 매칭 검증 (모든 슬라이드가 패턴 매칭되어야 함)
  let unmatchedCount = 0;
  for (const slide of s.slides) {
    const pattern = getPatternForSlide(slide.slide_type);
    if (!pattern) unmatchedCount++;
  }
  checks.push({
    name: '모든 슬라이드 패턴 매칭',
    passed: unmatchedCount === 0,
    reason: unmatchedCount > 0 ? `${unmatchedCount}개 매칭 실패` : undefined,
  });

  // 6. Generator 가이드 생성
  let guideOk = true;
  for (const slide of s.slides) {
    const g = getPatternGuideForGenerator(slide.slide_type);
    if (!g.builderChartType) {
      guideOk = false;
      break;
    }
  }
  checks.push({
    name: 'Generator 가이드 생성',
    passed: guideOk,
    reason: !guideOk ? '일부 슬라이드 가이드 실패' : undefined,
  });

  // 7. 차트 스켈레톤 빌드
  for (const slide of s.slides) {
    const sk = getSkeletonForSection(slide.slide_type);
    if (sk) {
      checks.push({
        name: `스켈레톤 (${slide.slide_type})`,
        passed: !!sk.type,
        reason: !sk.type ? 'type 없음' : undefined,
      });
      break;
    }
  }

  const allPassed = checks.every((c) => c.passed);

  return {
    scenarioId: s.id,
    scenarioName: s.name,
    passed: allPassed,
    checks,
  };
}

// ============================================================================
// 메인
// ============================================================================
async function main() {
  console.log('🎬 End-to-End 사용자 시나리오 검증');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`총 ${scenarios.length}개 시나리오\n`);

  console.log('📦 모듈 로드 확인:');
  console.log(`  - 인터뷰 질문: ${INTERVIEW_QUESTIONS.length}개`);
  console.log(`  - 카테고리: ${Object.keys(CATEGORY_LABELS).length}개`);
  console.log(`  - PPT 패턴: ${listAllPatterns().length}개`);
  console.log(`  - 카테고리 그룹: ${Object.keys(groupQuestionsByCategory()).length}개`);
  console.log('');

  const tam = buildTamSamSomPreset({ tam: 100, sam: 30, som: 5, unit: '억$' });
  console.log(`🧪 TAM/SAM/SOM 빌더: ${tam.type} (data 키: ${Object.keys(tam.data as object).length})`);

  const sel = selectPatternForContent({ slideType: 'market', text: 'TAM 50조' });
  console.log(`🧪 패턴 셀렉터: ${sel.primaryChartType} (빌더 ${sel.builderChartType})`);
  console.log('');

  const results: ScenarioResult[] = [];
  for (const s of scenarios) {
    console.log(`▶ [${s.id}] ${s.name}`);
    const r = runScenario(s);
    results.push(r);

    r.checks.forEach((c) => {
      const icon = c.passed ? '✅' : '❌';
      const reason = c.reason ? ` (${c.reason})` : '';
      console.log(`    ${icon} ${c.name}${reason}`);
    });
    console.log(`    => ${r.passed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  const totalChecks = results.reduce((sum, r) => sum + r.checks.length, 0);
  const passedChecks = results.reduce(
    (sum, r) => sum + r.checks.filter((c) => c.passed).length,
    0
  );

  console.log(`시나리오: ${passed}/${results.length} 통과`);
  console.log(`체크: ${passedChecks}/${totalChecks} 통과`);

  if (failed > 0) {
    console.log('\n❌ 실패 시나리오:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.scenarioId}: ${r.scenarioName}`);
        r.checks
          .filter((c) => !c.passed)
          .forEach((c) => console.log(`      ${c.name}: ${c.reason}`));
      });
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
