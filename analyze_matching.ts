import { callClaude } from "./src/lib/ai/claude";

// 회사 프로필
const companyProfile = `
회사명: 테크노바(주)
설립: 2023년 (1년 경과)
소재지: 서울시 강남구
직원: 12명
2024년 매출: 3억원, 성장률 200%
주요 사업: AI 기반 SaaS 플랫폼
  - 회계자동화 (NLP 자동 분개 엔진)
  - 급여계산
  - 재고예측
기술 특징:
  - NLP 자동 분개 엔진으로 결산시간 3일→30분 단축
  - 특허 2건(등록), 1건(출원중)
  - 시드투자 5억원 유치
  - 베타고객 50개사
  - 정부과제 3건 수행 경험
  - ISO27001, GS인증 보유
  - 대기업 3곳 MOU 체결
  - 글로벌 진출 계획(동남아)
`;

// 5개 지원사업
const programs = [
  {
    idx: 0,
    title: "제17회 예비관광벤처사업",
    summary: "사업화, 전국, 예비창업자",
    target: "예비창업자(사업자등록증 없는)",
    keywords: "관광사업",
  },
  {
    idx: 1,
    title: "2026년 해양수산 창업·투자 지원사업",
    summary: "사업화, 전국, 예비~10년",
    target: "해양수산 분야 예비창업자, 1~10년 기업",
    keywords: "해양수산",
  },
  {
    idx: 2,
    title: "제17회 성장관광벤처사업",
    summary: "사업화, 전국, 7년미만",
    target: "창업후 3년 초과 7년 이내",
    keywords: "관광사업",
  },
  {
    idx: 3,
    title: "디노랩 충북3기",
    summary: "사업화, 충북, 예비~7년",
    target: "충청권 소재 + 청년창업사관학교 졸업 OR 7년이내",
    keywords: "스타트업",
  },
  {
    idx: 4,
    title: "경남 지식재산 긴급지원",
    summary: "사업화, 경남, 1~10년",
    target: "경상남도 소재 중소기업",
    keywords: "지식재산",
  },
];

const programList = programs
  .map(
    (p) =>
      `### 공고 [${p.idx}]: ${p.title}
내용: ${p.summary}
대상: ${p.target}
키워드: ${p.keywords}`
  )
  .join("\n\n");

const systemPrompt = `당신은 정부지원사업 매칭 전문 컨설턴트입니다. 회사 프로필과 여러 지원사업을 분석하여 각각의 매칭 점수를 산출합니다.

## 점수 기준 (엄격)
- 80+: 핵심 분야 정확히 일치 (5~8%)
- 60-79: 분야 관련성 높음 (15~20%)
- 40-59: 간접 관련 (20~25%)
- 40 미만: 분야 불일치 (50%+)

## 5개 영역 (합산 100점)
1. 키워드 연관도 (30점): 핵심 업종/기술 직접 관련성
2. 사업방향 일치도 (25점): 전략 부합
3. 자격요건 부합도 (20점): 규모/업력/업종
4. 필요성 & 활용도 (15점): 실질적 도움
5. 선정 가능성 (10점): 경쟁력/차별성

## 출력 형식 (JSON 배열만, 추가 설명 없이)
\`\`\`json
[
  {"idx":0,"score":75,"reason":"매칭 사유 1-2줄","keywords":["키워드1","키워드2"],"detail":"상세 3-5줄","breakdown":{"keyword_relevance":22,"direction_fit":20,"eligibility":15,"necessity":10,"competitiveness":8},"fit":"적합"},
  {"idx":1,"score":35,"reason":"사유","keywords":["키워드"],"detail":"상세","breakdown":{"keyword_relevance":5,"direction_fit":10,"eligibility":10,"necessity":7,"competitiveness":3},"fit":"참고"}
]
\`\`\`

fit: 80+→"매우적합", 60-79→"적합", 40-59→"검토추천", 20-39→"참고", 0-19→"부적합"
한국어.`;

const userPrompt = `## 회사 프로필
${companyProfile}

## 지원사업 목록 (${programs.length}건)
${programList}`;

async function runAnalysis() {
  try {
    const response = await callClaude({
      model: "claude-haiku-4-5-20251001",
      maxTokens: 4096,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
    });

    console.log(response);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

runAnalysis();
