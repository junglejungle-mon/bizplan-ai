/**
 * 사업계획서 자동 작성 프롬프트 — 3단계 공정 고도화 v3
 * Stage 0: 양식 인식 + 자동 분류 + 평가 기준 추출
 * Stage 1: 텍스트 초안 (선정 패턴 + 리서치 + 품질 검증)
 * Stage 2: 인포그래픽/차트 데이터 추출
 */

// ========================================
// Stage 0: 양식 인식 + 자동 분류
// ========================================

// 0-1. 양식 자동 분류 (Haiku — 빠르고 저렴)
export type TemplateType =
  | "startup_package"
  | "growth_package"
  | "dips"
  | "export_voucher"
  | "sme_fund"
  | "innovation_growth"
  | "custom";

export const TEMPLATE_CLASSIFIER_SYSTEM = `사업계획서 양식 OCR 텍스트를 분석하여 어떤 정부지원사업 유형인지 분류하세요.

# 분류 기준
- startup_package: "초기창업패키지" 키워드 또는 Problem/Solution/Scale-up/Team 4섹션 구조
- growth_package: "창업도약패키지" 키워드 또는 사업화실적 강조 구조
- dips: "초격차 스타트업 프로젝트" 또는 "DIPS" 키워드
- export_voucher: "수출바우처" 또는 "수출지원기반활용" 키워드
- sme_fund: "중소기업진흥공단" 또는 "청년창업사관학교" 또는 "청년창업전용자금"
- innovation_growth: "혁신성장" 또는 "기술혁신" 키워드
- custom: 위 분류에 해당하지 않는 경우

# 출력 형식
\`\`\`json
{
  "template_type": "startup_package",
  "confidence": 0.95,
  "detected_keywords": ["초기창업패키지", "Problem", "Solution"],
  "estimated_pages": 15,
  "key_sections": ["일반현황", "아이템 개요", "문제 인식", "실현 가능성", "성장전략", "팀 구성"]
}
\`\`\`

JSON만 출력하세요.`;

export function buildTemplateClassifierPrompt(ocrText: string) {
  return `OCR 텍스트 (처음 2000자):\n${ocrText.slice(0, 2000)}\n\n이 양식은 어떤 정부지원사업 유형인가요?`;
}

// 양식 유형별 평가 배점 기본값 (평가기준 추출 실패 시 사용)
export const DEFAULT_EVAL_WEIGHTS: Record<TemplateType, Array<{ 항목: string; 배점: number }>> = {
  startup_package: [
    { 항목: "문제인식", 배점: 25 },
    { 항목: "실현가능성", 배점: 30 },
    { 항목: "성장전략", 배점: 25 },
    { 항목: "팀구성", 배점: 20 },
  ],
  growth_package: [
    { 항목: "사업화실적", 배점: 30 },
    { 항목: "기술차별성", 배점: 25 },
    { 항목: "성장전략", 배점: 25 },
    { 항목: "팀역량", 배점: 20 },
  ],
  dips: [
    { 항목: "딥테크기술", 배점: 35 },
    { 항목: "사업화역량", 배점: 25 },
    { 항목: "성장잠재력", 배점: 25 },
    { 항목: "팀구성", 배점: 15 },
  ],
  export_voucher: [
    { 항목: "수출역량", 배점: 30 },
    { 항목: "마케팅전략", 배점: 25 },
    { 항목: "제품경쟁력", 배점: 25 },
    { 항목: "기업역량", 배점: 20 },
  ],
  sme_fund: [
    { 항목: "사업타당성", 배점: 25 },
    { 항목: "기술혁신", 배점: 25 },
    { 항목: "경영역량", 배점: 25 },
    { 항목: "성장가능성", 배점: 25 },
  ],
  innovation_growth: [
    { 항목: "기술혁신성", 배점: 30 },
    { 항목: "사업성", 배점: 25 },
    { 항목: "성장전략", 배점: 25 },
    { 항목: "경영역량", 배점: 20 },
  ],
  custom: [
    { 항목: "사업개요", 배점: 25 },
    { 항목: "기술/제품", 배점: 25 },
    { 항목: "시장/전략", 배점: 25 },
    { 항목: "팀/재무", 배점: 25 },
  ],
};

// ========================================
// Stage 0-2: 섹션 추출 + 평가 기준
// ========================================

// 1. 사업계획서 양식에서 섹션 추출 (Sonnet)
export const SECTION_EXTRACTOR_SYSTEM = `제공된 사업계획서 양식 샘플에서 사업 계획 및 추진 계획의 내용을 추출하라.

# 조건
- **사업 계획 혹은 사업 추진 계획**에 관련된 내용만을 추출하여 그것이 발생하는 섹션의 제목과 함께 출력하라.
- 각 섹션이 포함하는 가이드나 지침이 있다면 구체적으로 기술하라.
- 추출된 내용과 각 섹션의 이름을 하나의 번들로 JSON 형식으로 출력하라.

# 출력 형식
\`\`\`json
{
  "sections": [
    {
      "section_name": "섹션 이름",
      "guidelines": "작성 지침/가이드",
      "section_order": 1
    }
  ]
}
\`\`\`

JSON만 출력하세요.`;

export function buildSectionExtractorPrompt(ocrText: string) {
  return `<샘플>\n${ocrText}\n</샘플>`;
}

// 2. 평가 기준 추출 (Sonnet)
export const EVALUATION_EXTRACTOR_SYSTEM = `공고문에서 평가 항목과 배점을 추출하세요.

# 출력 형식
\`\`\`json
{
  "criteria": [
    {
      "항목": "평가 항목명",
      "배점": 30,
      "세부기준": "세부 평가 기준 설명"
    }
  ],
  "total": 100
}
\`\`\`

JSON만 출력하세요. 평가 기준을 찾을 수 없으면 빈 배열을 반환하세요.`;

// ========================================
// Stage 1: 텍스트 초안 작성
// ========================================

// 3. 리서치 필요 여부 판단 (Haiku — 빠르고 저렴)
export const RESEARCH_JUDGE_SYSTEM = `주어진 사업계획서 섹션의 작성에 외부 리서치(시장 데이터, 통계, 트렌드 등)가 필요한지 판단하세요.

# 판단 기준
- 시장 규모, 성장률, 트렌드 등 외부 데이터가 필요하면 1
- 회사 내부 정보(기술, 팀, 일정 등)만으로 충분하면 0

# 출력 형식
\`\`\`json
{
  "reasoning": "판단 근거",
  "needs_research": 1
}
\`\`\`

JSON만 출력하세요.`;

export function buildResearchJudgePrompt(
  sectionName: string,
  guidelines: string,
  businessContent: string
) {
  return `섹션명: ${sectionName}
작성지침: ${guidelines || "없음"}
회사정보 요약: ${businessContent.slice(0, 300)}

이 섹션을 작성하려면 외부 시장 리서치가 필요한가요?`;
}

// 4. 검색 쿼리 생성 (Haiku)
export const SEARCH_QUERY_SYSTEM = `사업계획서 섹션 작성을 위한 시장 리서치 검색 쿼리를 한국어와 영어로 각 1개씩 생성하세요.

# 출력 형식
\`\`\`json
{
  "ko": "한국어 검색 쿼리",
  "en": "English search query"
}
\`\`\`

JSON만 출력하세요. 검색어는 구체적이고 최신 데이터를 찾을 수 있도록 작성하세요.`;

export function buildSearchQueryPrompt(
  sectionName: string,
  guidelines: string,
  businessContent: string
) {
  return `섹션: ${sectionName}
지침: ${guidelines || "없음"}
회사 사업 분야: ${businessContent.slice(0, 200)}

이 섹션 작성에 필요한 시장 리서치 검색어를 생성하세요.`;
}

// 5. 섹션 작성 (Sonnet — 핵심) — 선정 패턴 반영 v4 (분량 대폭 확대)
export const SECTION_WRITER_SYSTEM = `당신은 대한민국 정부지원사업 사업계획서 작성 전문가입니다.
실제 선정된 사업계획서 12건(초기창업패키지, 창업도약패키지, DIPS, 수출바우처, 중진공 자금)의 패턴을 학습하여 고득점 사업계획서를 작성합니다.

# 분량 원칙 (매우 중요!)
- **일반 섹션**: 최소 2,000자 ~ 4,000자 (A4 1~2페이지 분량)
- **핵심 섹션** (배점 25점 이상 또는 Problem/Solution/Market): 최소 3,500자 ~ 6,000자 (A4 2~3페이지)
- **간략 섹션** (일반현황, 요약): 1,200자 ~ 2,000자
- 절대로 1,000자 미만의 짧은 섹션을 생성하지 마세요
- 실제 선정 사업계획서의 각 섹션은 A4 1.5~3페이지 분량 (3,000~6,000자)

# 작성 규칙
1. 전문적이고 공식적인 어체 사용
2. 비즈니스 전문 용어 적절히 활용
3. **계층적 구조**: 대제목(##) > 소제목(###) > 불릿(-)으로 깊이 있는 구성
4. 각 소제목 아래에 **구체적인 설명 3~5문장** 이상 작성 (키워드만 나열 금지)
5. 객관적이고 중립적인 어조
6. **개조식 어체** (명사형 종결: -음, -임, -함) — 단, 핵심 설명은 충분히 서술
7. 평가 기준에서 배점이 높은 항목에 더 상세하게, 더 길게 작성
8. 구체적인 수치, 일정, 목표를 포함 — 모든 주장에 근거 수치 필수
9. 3인칭 서술 (당사, 본 사업 등)
10. **스토리텔링**: 단순 나열이 아닌 논리적 흐름 (문제→원인→해결→효과)

# 선정 사업계획서 필수 패턴 (반드시 포함)
1. **숫자 기반 실적**: 모든 주장에 수치 근거 (매출 ○억, 성장률 ○%, 고객 ○명)
   ✅ "23년 매출 8억, 24년 30억 (전년 대비 275% 성장)"
   ❌ "빠르게 성장하고 있음" (구체적 수치 없음)
2. **TAM/SAM/SOM**: 시장 관련 섹션에 반드시 포함 (출처 명시)
   ✅ TAM: 글로벌 시장 695억달러 (Statista, 2024) → SAM: 아시아 34.75억달러 → SOM: 자사 타깃 1,740만달러
3. **경쟁사 비교표**: 마크다운 테이블로 자사 vs 경쟁사 A vs B 비교 (최소 5개 비교 항목)
4. **구체적 로드맵**: 월별/분기별 추진 일정 (마크다운 테이블 또는 타임라인)
5. **팀 역량**: 학력+경력(년수)+대표 실적(수치)+해당사업 연관성
6. **리스크+대응**: 최소 3개 리스크 식별 + 각각의 구체적 대응 전략
7. **사회적 가치**: 고용창출(○명), 탄소중립, ESG, 지역경제 기여
8. **실적/성과 근거**: LoI, MoU, 시범사업, 특허, 인증 등 구체적 에비던스
9. **자금 사용 계획**: 항목별 산출근거 포함 (단가 × 수량 × 기간)

# 깊이 있는 서술 가이드
각 소주제에 대해 반드시 다음을 포함:
- **현황 분석**: 현재 상황/문제를 데이터와 함께 설명 (2~3문장)
- **당사 접근방식**: 어떻게 해결/달성할 것인지 (3~5문장)
- **차별화 포인트**: 기존 대비 우위/독창성 (2~3문장)
- **기대 성과**: 구체적 수치 목표 (1~2문장)
→ 소주제 1개당 최소 8~13문장을 목표

# 인포그래픽 시각화 지침 (매우 중요!)
각 섹션에 **인포그래픽으로 변환 가능한 구조화된 데이터**를 반드시 포함하세요.
평가위원의 가독성과 임팩트를 높이기 위해 텍스트만이 아닌 시각화 가능한 요소를 적극 배치합니다.

## 섹션별 인포그래픽 필수 요소
1. **문제 인식 (Problem)**:
   - 페인포인트 다이어그램 데이터 (3대 문제점 + 수치)
   - 기존 vs 신규 비교 그래프 데이터 (성능/비용/효율 비교)
   - 시장 파이차트 데이터 (점유율 또는 비중)

2. **실현 가능성 (Solution)**:
   - 기술 구조도 설명 (단계별 프로세스, 레이어 구조)
   - 핵심 수치 하이라이트 카드 (3~4개: 성능 향상률, 비용 절감률 등)
   - 기존 기술 vs 당사 기술 비교표 (5개+ 항목)

3. **성장전략 (Scale-up)**:
   - TCO(총 소요 비용) 비교 시뮬레이션 데이터 (기존 vs 도입 후)
   - 단계별 시장 진입 로드맵 (3단계: 초기→확대→글로벌)
   - 수익 모델 구조도 (2~3 Track: 판매/구독/컨설팅 등)
   - 연도별 매출 목표 바차트 데이터
   - ESG 성과 수치화 (환경/사회/지배구조 3컬럼)

4. **팀 구성 (Team)**:
   - 조직도 데이터 (대표→핵심인력→채용예정 구조)
   - 협력 생태계 맵 데이터 (4~5개 협력기관 + 역할)

## 인포그래픽 데이터 마크다운 표기법
시각화 가능한 데이터는 다음과 같이 마크다운에 명확히 표기:
- 비교표: 마크다운 테이블 (| 항목 | 기존 | 당사 | 개선효과 |)
- 수치 카드: **💰 30억** (매출), **📈 275%** (성장률), **👥 15명** (인력)
- 로드맵: 테이블 형식 (| 단계 | 기간 | 목표 | 대상 | 핵심활동 |)
- 예산: 산출근거 테이블 (| 비목 | 단가 | 수량 | 금액 | 비고 |)

# 포맷
- 마크다운 형식으로 작성
- 소제목(###), 불릿 포인트, **표를 적극 활용** (비교/데이터 시각화)
- 핵심 수치는 **볼드** 처리
- 마크다운 테이블: 최소 1~2개 이상 포함 (비교표, 일정표, 예산표 등)
- 분량: 섹션당 2,000-4,000자 (배점 높은 섹션은 6,000자까지)
- 정보 부족 시 [회사에서 입력 필요] 표시
- ⚠️ 절대 분량을 줄이지 마세요. 충분히 상세하게 작성하세요.`;

export function buildSectionWriterPrompt(opts: {
  sectionName: string;
  guidelines: string;
  businessContent: string;
  previousSections: string;
  evaluationWeight?: number;
  researchKo?: string;
  researchEn?: string;
  templateType?: TemplateType;
}) {
  let prompt = `# 작성 대상 섹션
**섹션명**: ${opts.sectionName}
**작성 지침**: ${opts.guidelines || "자유 서술"}
${opts.evaluationWeight ? `**평가 배점**: ${opts.evaluationWeight}점 (높은 배점 → 더 상세히 작성)` : ""}
${opts.templateType ? `**양식 유형**: ${opts.templateType}` : ""}

# 회사 정보
${opts.businessContent}

# 이미 작성된 앞 섹션들
${opts.previousSections || "(첫 번째 섹션)"}`;

  if (opts.researchKo || opts.researchEn) {
    prompt += `\n\n# 시장 리서치 결과
${opts.researchKo ? `## 한국어 리서치\n${opts.researchKo}` : ""}
${opts.researchEn ? `## 영어 리서치\n${opts.researchEn}` : ""}

리서치 결과를 깊게 분석하여 섹션 내용에 논리적으로 반영하세요. 출처를 명시하세요.`;
  }

  // 선정 패턴 체크리스트 (섹션 유형별 맞춤 — v4 상세화)
  const sectionLower = opts.sectionName.toLowerCase();
  const checks: string[] = [];

  if (sectionLower.includes("시장") || sectionLower.includes("market") || sectionLower.includes("문제") || sectionLower.includes("problem") || sectionLower.includes("개요")) {
    checks.push("- TAM/SAM/SOM 시장 규모 반드시 포함 (구체적 금액 + 출처 + 연도)");
    checks.push("- 시장 성장률(CAGR) 명시 + 성장 드라이버 3가지 이상 분석");
    checks.push("- 기존 제품/서비스의 구체적 한계점 수치화 (3개 이상)");
    checks.push("- 목표 고객군 세분화 (페르소나 또는 고객 유형별 규모/특성)");
    checks.push("- 시장 구조도 또는 밸류체인 설명");
    checks.push("- 국내외 시장 트렌드 + 정부 정책 방향 연계");
    checks.push("⚠️ 이 섹션은 핵심 섹션: 최소 3,500자 이상 작성");
  }
  if (sectionLower.includes("경쟁") || sectionLower.includes("차별") || sectionLower.includes("기술") || sectionLower.includes("solution") || sectionLower.includes("실현")) {
    checks.push("- 경쟁사 비교표 포함 (자사 vs A사 vs B사, 최소 5개 비교 항목)");
    checks.push("- 차별성을 수치로 표현 (○○% 향상, ○배 절감, ○배 빠름)");
    checks.push("- 특허/IP 보유/출원 현황 명시 (등록번호 또는 [등록번호 입력 필요])");
    checks.push("- 기술 아키텍처 또는 제품 구성도 설명 (텍스트 기반)");
    checks.push("- 핵심 기술의 작동 원리 + 기존 기술 대비 개선점 상세 설명");
    checks.push("- 개발 로드맵: 단계별 기술 목표 + 완료 기준(KPI)");
    checks.push("- AI/딥테크 활용 시: 모델명, 학습데이터 규모, 정확도 등 구체적 명시");
    checks.push("⚠️ 이 섹션은 핵심 섹션: 최소 3,500자 이상 작성");
  }
  if (sectionLower.includes("전략") || sectionLower.includes("사업화") || sectionLower.includes("scale") || sectionLower.includes("로드맵") || sectionLower.includes("성장")) {
    checks.push("- 월별/분기별 상세 추진 일정표 (마크다운 테이블)");
    checks.push("- 비즈니스 모델 수익 구조 설명 (수익원별 금액 추정)");
    checks.push("- 단기(6개월)/중기(1~2년)/장기(3~5년) 구분된 로드맵");
    checks.push("- 마케팅/영업 전략: 채널별 전략 + 예상 성과");
    checks.push("- 해외 진출 전략: 타깃 국가 + 진입 방식 + 예상 매출");
    checks.push("- 투자유치 계획: 라운드별 금액 + 시기 + 용도");
    checks.push("- 연도별 매출 목표 테이블 (3~5년)");
    checks.push("⚠️ 이 섹션은 핵심 섹션: 최소 3,500자 이상 작성");
  }
  if (sectionLower.includes("팀") || sectionLower.includes("team") || sectionLower.includes("인력") || sectionLower.includes("조직")) {
    checks.push("- 대표자: 학력 + 경력(회사명, 직급, 년수) + 핵심 실적(수치) + 본 사업 연관성");
    checks.push("- 핵심 인력 3명 이상: 각각 학력+경력+실적+담당역할");
    checks.push("- 채용 계획: 시기+역할+인원수+요구역량+예상연봉");
    checks.push("- 업무파트너/협력기관 현황 (MoU, LoI 등 증빙)");
    checks.push("- 조직도 또는 업무 분장 테이블");
    checks.push("- 자문위원/멘토 네트워크 (있는 경우)");
  }
  if (sectionLower.includes("기대") || sectionLower.includes("효과") || sectionLower.includes("가치") || sectionLower.includes("예산") || sectionLower.includes("재무")) {
    checks.push("- 고용 창출 효과 (현재 ○명 → 목표 ○명, 시기별)");
    checks.push("- ESG/사회적 가치 (탄소중립, 순환경제, 지역경제 기여 등)");
    checks.push("- 정량적 기대 효과 수치 (매출, 수출, 고용, 기술이전)");
    checks.push("- 예산 테이블: 항목별 산출근거 (단가 × 수량 × 기간)");
    checks.push("- 정부지원금 vs 자부담 비율 명시");
    checks.push("- 리스크 요인 3개 이상 + 각각의 구체적 대응 전략");
  }
  if (sectionLower.includes("사업비") || sectionLower.includes("집행") || sectionLower.includes("예산")) {
    checks.push("- 사업비 항목별 상세 산출근거 테이블 (항목/단가/수량/금액/산출근거)");
    checks.push("- 정부지원금/자부담 구분 테이블");
    checks.push("- 분기별 집행 계획");
  }

  if (checks.length > 0) {
    prompt += `\n\n# 이 섹션 필수 체크리스트 (선정 패턴)\n${checks.join("\n")}`;
  }

  // 분량 지시 (섹션별 맞춤)
  const isCoreSectionKeyword = ["문제", "problem", "실현", "solution", "시장", "market", "전략", "scale", "성장", "사업화", "차별", "기술"];
  const isBriefSectionKeyword = ["일반현황", "신청", "요약"];
  const isCore = isCoreSectionKeyword.some(k => sectionLower.includes(k));
  const isBrief = isBriefSectionKeyword.some(k => sectionLower.includes(k));

  let minChars = 2000;
  let maxChars = 4000;
  if (isCore || (opts.evaluationWeight && opts.evaluationWeight >= 25)) {
    minChars = 3500;
    maxChars = 6000;
  } else if (isBrief) {
    minChars = 1200;
    maxChars = 2000;
  }

  prompt += `\n\n# 분량 요구사항
⚠️ 이 섹션은 **최소 ${minChars}자 ~ 최대 ${maxChars}자** 범위로 작성하세요.
${minChars}자 미만이면 불합격 처리됩니다. 충분히 상세하고 깊이 있게 작성하세요.
각 소주제에 대해 3~5문장 이상의 구체적 설명을 포함하세요.

위 정보를 바탕으로 "${opts.sectionName}" 섹션을 작성하세요. 마크다운 형식으로 출력하세요.`;

  return prompt;
}

// ========================================
// Stage 1.5: 품질 검증 (Validation)
// ========================================

// 6. 품질 점수 검증 (Haiku — 빠름)
export const QUALITY_VALIDATOR_SYSTEM = `작성된 사업계획서 섹션의 품질을 100점 만점으로 평가하세요.

# 평가 항목 (각 항목 10점)
1. 숫자_기반_실적: 매출/성장률/고객수 등 구체적 수치 3개 이상 포함
2. TAM_SAM_SOM: 시장 규모 분석 포함 + 출처 명시 여부 (해당 섹션인 경우)
3. 경쟁사_비교: 경쟁사 비교 마크다운 테이블 포함 (최소 3사, 5항목)
4. 구체적_로드맵: 월별/분기별 일정 테이블 포함
5. 팀_역량_상세: 학력+경력+실적 포함 + 본 사업 연관성 설명
6. 사업비_산출근거: 항목별 산출 근거 (단가×수량×기간)
7. 리스크_대응: 리스크 3개 이상 + 각각 대응 전략
8. 특허_IP: 출원번호 또는 구체적 계획 명시
9. 표_차트_활용: 마크다운 테이블 2개 이상 활용
10. 분량_적정성: 일반 섹션 2,000-4,000자, 핵심 섹션 3,500-6,000자 (1,500자 미만이면 0점)

# 출력 형식
\`\`\`json
{
  "scores": {
    "숫자_기반_실적": 8,
    "TAM_SAM_SOM": 7,
    "경쟁사_비교": 9,
    "구체적_로드맵": 6,
    "팀_역량_상세": 8,
    "사업비_산출근거": 5,
    "리스크_대응": 7,
    "특허_IP": 4,
    "표_차트_활용": 8,
    "분량_적정성": 9
  },
  "total": 71,
  "grade": "B",
  "char_count": 3250,
  "improvements": ["TAM/SAM/SOM 동심원 분석 추가 필요", "특허 출원 현황 보완 필요"],
  "strengths": ["매출 데이터 구체적", "경쟁사 비교표 잘 작성됨"]
}
\`\`\`

grade 기준: A(90+), B(80+), C(70+), D(60+), F(60미만)
JSON만 출력하세요.`;

export function buildQualityValidatorPrompt(
  sectionName: string,
  content: string,
  templateType?: TemplateType
) {
  return `## 검증 대상 섹션
섹션명: ${sectionName}
양식유형: ${templateType || "custom"}

## 작성된 내용
${content}

위 사업계획서 섹션의 품질을 평가하세요. 해당 섹션에 적합하지 않은 항목은 N/A로 처리하고 점수 계산에서 제외하세요.`;
}

// ========================================
// Stage 2: 인포그래픽 데이터 추출
// ========================================

// 7. 차트/데이터 추출 (Haiku — 빠름) — v2 인포그래픽 강화 (초기창업패키지 양식 기반)
export const CHART_DATA_EXTRACTOR_SYSTEM = `작성된 사업계획서 섹션에서 차트/인포그래픽으로 시각화할 수 있는 데이터를 추출하세요.

# 추출 대상 데이터 유형 (10가지)
1. bar: 막대차트 (매출 추이, 비교 데이터)
2. pie: 파이차트 (구성 비율, 사업비 배분)
3. line: 선그래프 (성장 추이, 예측)
4. tam_sam_som: 동심원차트 (시장 규모)
5. comparison_table: 비교테이블 (경쟁사 비교)
6. timeline: 타임라인 (로드맵, 일정)
7. highlight_cards: 수치 하이라이트 카드 (핵심 KPI)
8. pain_points: 페인포인트 다이어그램 (시장 문제점 3~4개 + 수치)
9. tco_comparison: TCO 비용 비교 (기존 vs 도입 후 비용 항목별 비교)
10. revenue_model: 수익 모델 구조도 (2~3 Track별 가격/특징)
11. org_chart: 조직도 (대표→핵심인력→채용예정)
12. ecosystem_map: 협력 생태계 맵 (중심 기업 + 4~5 협력기관)
13. esg_cards: ESG 성과 카드 (환경/사회/지배구조 3컬럼)
14. step_roadmap: 단계별 시장 진입 로드맵 (1단계→2단계→3단계)

# 섹션별 권장 인포그래픽
- 문제 인식/Problem: pain_points, comparison_table (기존 vs 신규), pie
- 실현 가능성/Solution: comparison_table, highlight_cards, bar
- 성장전략/Scale-up: tco_comparison, step_roadmap, revenue_model, timeline, esg_cards, bar
- 팀 구성/Team: org_chart, ecosystem_map
- 아이템 개요: highlight_cards, tam_sam_som
- 사업비/예산: bar (항목별), pie (비중)

# 출력 형식
\`\`\`json
{
  "charts": [
    {
      "chart_type": "bar",
      "title": "매출 추이",
      "data": {
        "labels": ["2023년", "2024년", "2025년(목표)"],
        "datasets": [{"label": "매출(억원)", "values": [8, 30, 80]}]
      },
      "position": "시장분석 섹션 하단",
      "priority": "high"
    },
    {
      "chart_type": "highlight_cards",
      "title": "핵심 성과",
      "data": {
        "cards": [
          {"icon": "💰", "value": "30억", "label": "2024년 매출"},
          {"icon": "📈", "value": "275%", "label": "전년 대비 성장"},
          {"icon": "👥", "value": "15명", "label": "임직원"}
        ]
      },
      "position": "아이템 개요",
      "priority": "high"
    },
    {
      "chart_type": "tam_sam_som",
      "title": "시장 규모",
      "data": {
        "tam": {"value": 695, "unit": "억달러", "label": "글로벌 시장"},
        "sam": {"value": 34.75, "unit": "억달러", "label": "아시아 시장"},
        "som": {"value": 0.174, "unit": "억달러", "label": "초기 목표 시장"}
      },
      "position": "시장분석 섹션",
      "priority": "high"
    },
    {
      "chart_type": "pain_points",
      "title": "시장 3대 페인포인트",
      "data": {
        "points": [
          {"icon": "⚡", "title": "에너지 낭비", "value": "연간 15조 원", "description": "공조시스템 전력 소비"},
          {"icon": "🗑️", "title": "폐기물 발생", "value": "연간 12만 톤", "description": "폐필터 매립/소각"},
          {"icon": "📈", "title": "비용 상승", "value": "연 4회 교체", "description": "유지보수 인건비 부담"}
        ]
      },
      "priority": "high"
    },
    {
      "chart_type": "tco_comparison",
      "title": "총 소요 비용(TCO) 50% 절감",
      "data": {
        "before": {"label": "기존 시스템", "total": "약 1억 원/연", "items": [
          {"name": "구매비", "value": "4,000만"},
          {"name": "에너지비", "value": "3,000만"},
          {"name": "폐기물 처리비", "value": "2,000만"},
          {"name": "인건비", "value": "1,000만"}
        ]},
        "after": {"label": "도입 후", "total": "약 5천만 원/연", "items": [
          {"name": "구매비", "value": "850만"},
          {"name": "에너지비", "value": "1,800만"},
          {"name": "폐기물 처리비", "value": "200만"},
          {"name": "인건비", "value": "250만"}
        ]},
        "saving_rate": "50%"
      },
      "priority": "high"
    },
    {
      "chart_type": "step_roadmap",
      "title": "단계별 시장 진입 로드맵",
      "data": {
        "steps": [
          {"step": 1, "title": "초기 시장 진입", "period": "2026-2027", "target": "제조 공장, 물류센터", "goal": "매출 1억 원"},
          {"step": 2, "title": "시장 확대", "period": "2027-2028", "target": "공공기관, 병원", "goal": "매출 15억 원"},
          {"step": 3, "title": "글로벌 진출", "period": "2028~", "target": "해외 시장", "goal": "매출 50억 원"}
        ]
      },
      "priority": "high"
    },
    {
      "chart_type": "revenue_model",
      "title": "3-Track 수익 모델",
      "data": {
        "tracks": [
          {"name": "Direct Sales", "subtitle": "제품 단품 판매", "price": "85,000원/개", "features": ["일회성 구매", "즉각적 매출", "초기 시장 점유"]},
          {"name": "Subscription", "subtitle": "구독 서비스", "price": "월 15,000원/대", "features": ["정기 교체", "안정적 수익", "고객 이탈 방지"]},
          {"name": "AI Consulting", "subtitle": "에너지 진단", "price": "건당 300만원", "features": ["고부가가치", "프리미엄", "에너지 최적화"]}
        ]
      },
      "priority": "medium"
    },
    {
      "chart_type": "esg_cards",
      "title": "ESG 경영 성과",
      "data": {
        "environment": {"title": "Environment", "items": ["탄소 배출 2만 톤 저감", "폐필터 1만 톤 감축"]},
        "social": {"title": "Social", "items": ["지역 일자리 20명 창출", "중소기업 에너지 교육"]},
        "governance": {"title": "Governance", "items": ["투명 경영 실현", "직원 복지 향상"]}
      },
      "priority": "medium"
    }
  ]
}
\`\`\`

- 시각화 가능한 데이터가 없으면 빈 배열 반환
- priority: high(필수), medium(권장), low(선택)
- 각 섹션당 최소 2개 이상의 인포그래픽 데이터를 추출하세요
- JSON만 출력하세요.`;

export function buildChartDataExtractorPrompt(
  sectionName: string,
  content: string
) {
  return `## 데이터 추출 대상
섹션명: ${sectionName}

## 섹션 내용
${content}

위 사업계획서 섹션에서 차트/인포그래픽으로 시각화할 데이터를 추출하세요.`;
}

// 8. 전체 사업계획서에서 핵심 KPI 추출 (완성 후 한 번)
export const KPI_EXTRACTOR_SYSTEM = `완성된 사업계획서 전체에서 핵심 성과 지표(KPI)를 추출하세요.

# 출력 형식
\`\`\`json
{
  "company_name": "회사명",
  "item_name": "창업아이템명",
  "kpis": {
    "revenue": [{"year": "2024", "value": 30, "unit": "억원"}],
    "growth_rate": "275%",
    "employees": 15,
    "customers": "15곳",
    "patents": "등록 4건, 출원 1건",
    "exports": "10만달러",
    "tam": {"value": 695, "unit": "억달러"},
    "sam": {"value": 34.75, "unit": "억달러"},
    "som": {"value": 0.174, "unit": "억달러"},
    "funding_request": {"value": 150, "unit": "백만원"},
    "total_budget": {"value": 214.3, "unit": "백만원"}
  },
  "competitors": [
    {"name": "경쟁사A", "market_share": "35%"},
    {"name": "경쟁사B", "position": "글로벌 1위"}
  ],
  "milestones": [
    {"date": "2026.Q1", "event": "시제품 개발"},
    {"date": "2026.Q2", "event": "양산 체제 구축"}
  ]
}
\`\`\`

JSON만 출력하세요.`;

// ========================================
// 기본 섹션 템플릿
// ========================================

// 9. 기본 섹션 템플릿 (양식 OCR이 없을 때) — v4 상세화
export const DEFAULT_SECTIONS = [
  {
    section_name: "사업 개요",
    guidelines: `사업의 배경, 목적, 필요성을 기술하되 다음 항목을 반드시 포함:
1) 사업 배경: 사회/산업적 문제점 + 데이터 근거 (시장 규모, 피해 규모 등)
2) 사업 목적: 핵심 해결 과제 + 기대 성과 (수치)
3) 아이템 개요: 제품/서비스명, 핵심 기능, 고객 혜택, 사양/가격
4) TAM/SAM/SOM 시장 규모 (출처 + 연도 명시)
5) 핵심 성과 하이라이트: 매출, 고객수, 특허 등 주요 수치 나열
★ 이 섹션은 2,000~3,000자로 작성. 사업 전체의 요약이자 첫인상을 결정하는 섹션.`,
    section_order: 1,
  },
  {
    section_name: "기업 현황",
    guidelines: `기업의 전반적 현황을 상세히 기술:
1) 기업 일반현황: 법인명, 대표자, 설립일, 소재지, 업종, 자본금
2) 연혁: 주요 연도별 이벤트 (설립, 투자유치, 수상, 인증, 해외진출 등)
3) 조직 현황: 부서별 인원 + 조직도 설명
4) 주요 실적: 매출 추이 (3개년), 주요 고객사/거래처, 수상 이력
5) 보유 기술/인프라: 특허, 인증, 핵심 기술 스택, 생산설비
6) 재무 현황: 매출, 영업이익, 자산총계 (최근 2~3개년)
★ 마크다운 테이블 활용 (연혁표, 실적표, 재무표). 2,000~3,000자.`,
    section_order: 2,
  },
  {
    section_name: "기술 개발 내용",
    guidelines: `개발하려는 기술/제품의 핵심 내용을 다음 구조로 작성:
1) 기술 개요: 핵심 기술의 원리와 작동 방식 (구체적으로)
2) 기술 차별성: 기존 기술 대비 개선점 (수치화: ○○% 향상, ○배 절감)
3) 경쟁사 비교표: 자사 vs 경쟁사 A vs B (마크다운 테이블, 5개+ 비교 항목)
4) 특허/IP 현황: 등록 ○건, 출원 ○건 (등록번호 또는 [입력 필요])
5) 기술 개발 계획: 단계별 개발 목표 + 완료 기준 + 일정
6) AI/딥테크 활용: 모델명, 데이터 규모, 성능 지표 (해당 시)
★ 핵심 섹션: 3,500~6,000자. 평가위원이 가장 꼼꼼히 보는 섹션.`,
    section_order: 3,
  },
  {
    section_name: "시장 분석",
    guidelines: `시장을 다층적으로 분석:
1) TAM: 전체 시장 규모 (글로벌, 금액+출처+연도+CAGR)
2) SAM: 유효 시장 (지역/세그먼트별 필터링)
3) SOM: 초기 목표 시장 (자사 역량 기반 현실적 규모)
4) 시장 트렌드: 성장 드라이버 3가지 이상 + 정부 정책 방향
5) 목표 고객: 고객 세그먼트별 규모, 특성, 니즈, 지불의사
6) 경쟁 분석: 경쟁 구도 + 포지셔닝 맵 설명 + 비교표
7) 진입 장벽 분석: 기술/규제/자본/브랜드 장벽과 자사 대응
★ 핵심 섹션: 3,500~6,000자. 리서치 데이터 적극 활용, 출처 명시 필수.`,
    section_order: 4,
  },
  {
    section_name: "사업화 전략",
    guidelines: `구체적 사업화 및 성장 전략:
1) 비즈니스 모델: 수익원 구조 (구독/거래수수료/라이선스 등) + 예상 수익
2) 마케팅 전략: 채널별 전략 (온라인/오프라인/파트너십) + 예상 CAC/LTV
3) 영업 전략: 타깃 고객 접근 방식 + 기확보 파이프라인
4) 해외 진출: 타깃 국가 + 진입 방식 (직진출/파트너/현지법인) + 예상 매출
5) 파트너십: MoU/LoI 체결 현황 + 추가 확보 계획
6) 투자유치 계획: 라운드별 금액 + 시기 + 용도
7) 연도별 매출 목표: 3~5년 매출/영업이익 예측 테이블
★ 핵심 섹션: 3,500~6,000자. 숫자 기반의 실현 가능한 전략.`,
    section_order: 5,
  },
  {
    section_name: "추진 일정",
    guidelines: `상세한 추진 계획과 마일스톤:
1) 전체 추진 일정표: 월별/분기별 마크다운 테이블 (과제/일정/담당/성과지표)
2) 단계별 주요 마일스톤: 각 마일스톤의 완료 기준(KPI) 명시
3) 단기 계획 (6개월): 월별 상세 액션 아이템
4) 중기 계획 (1~2년): 분기별 핵심 목표
5) 장기 계획 (3~5년): 연도별 성장 목표
6) 성과 지표(KPI): 단계별 정량적 목표 (매출, 고객수, 기술지표)
★ 2,000~4,000자. 마크다운 테이블 필수.`,
    section_order: 6,
  },
  {
    section_name: "소요 예산",
    guidelines: `항목별 예산 계획을 상세히 기술:
1) 총괄 예산표: 정부지원금/자부담/계 (마크다운 테이블)
2) 항목별 산출근거: 각 항목의 단가 × 수량 × 기간 = 금액 + 산출근거
3) 주요 비목: 인건비/재료비/외주용역비/기자재구입비/여비/특허비 등
4) 분기별 집행 계획
5) 자부담 재원 조달 방안
★ 2,000~3,000자. 산출근거 테이블이 핵심. 단가×수량 형식 필수.`,
    section_order: 7,
  },
  {
    section_name: "기대 효과",
    guidelines: `사업 완료 후 기대되는 성과와 효과:
1) 기술적 기대 효과: 핵심 기술 확보, 성능 향상 수치, 국내외 기술 수준
2) 경제적 기대 효과: 매출 목표 (3~5년), 수출 목표, 비용 절감 효과
3) 사회적 기대 효과: 고용 창출 (현재 ○명 → ○명), 지역경제 기여
4) ESG/사회적 가치: 탄소중립, 순환경제, 사회문제 해결 기여
5) 산업 파급 효과: 밸류체인 확대, 관련 산업 성장 기여
6) 리스크 요인 + 대응 전략: 최소 3개 리스크 × 대응방안
★ 2,000~3,500자. 모든 효과를 정량적 수치로 표현.`,
    section_order: 8,
  },
];

// 양식별 특화 기본 섹션 (OCR 실패 시 fallback) — v4 상세화
export const TEMPLATE_SECTIONS: Partial<Record<TemplateType, typeof DEFAULT_SECTIONS>> = {
  startup_package: [
    { section_name: "일반현황", guidelines: `기업 일반현황 테이블 형식:
1) 기업명, 대표자명, 법인등록번호, 사업자번호
2) 설립일자, 소재지, 업종, 주요제품
3) 팀 구성: 기술인력 ○명, 경영인력 ○명, 기타 ○명 (테이블)
4) 총 사업비: 정부지원금 ○백만원 + 자부담 ○백만원 = 총 ○백만원
5) 대표자 이력: 학력, 주요경력, 실적
★ 1,200~2,000자 (간략 섹션). 테이블 2개 이상.`, section_order: 1 },
    { section_name: "창업 아이템 개요(요약)", guidelines: `아이템의 전체상을 압축적으로 제시:
1) 아이템명 + 범주 (기술/서비스 분류)
2) 제품/서비스 개요: 무엇을, 누구에게, 어떻게 (3~5문장)
3) 핵심 기능 3~5가지 (각각 1~2문장 설명)
4) 고객 혜택: 기존 대비 개선점 수치화
5) 사양/가격 테이블
6) 핵심 성과 하이라이트: 매출, 고객, 특허, 수상 등 숫자
7) 중장기 로드맵 요약 (3~5년)
★ 2,000~3,000자. A4 약 2페이지. 첫인상 결정 섹션.`, section_order: 2 },
    { section_name: "문제 인식(Problem)", guidelines: `시장의 문제를 데이터 기반으로 깊이 있게 분석:
1) 국내외 시장 현황: TAM/SAM/SOM (출처+연도+CAGR)
2) 기존 제품/서비스의 구체적 한계점 3가지 이상 (수치화)
3) 고객 Pain Point: 실제 고객 사례 또는 설문/인터뷰 데이터
4) 시장 성장 드라이버: 기술 트렌드 + 정부 정책 + 소비자 변화
5) 개발 필요성: 왜 지금 이 문제를 풀어야 하는지 논리적 서술
6) 관련 정책/규제 동향
★ 핵심 섹션: 3,500~6,000자. 평가 배점 高. 리서치 데이터 적극 활용.`, section_order: 3 },
    { section_name: "실현 가능성(Solution)", guidelines: `기술적 솔루션과 실현 가능성을 구체적으로 증명:
1) 핵심 기술 설명: 작동 원리 + 기술 아키텍처 (텍스트 기반 설명)
2) 기술 차별성: 기존 대비 ○○% 향상/○배 절감 (수치 필수)
3) 경쟁사 비교표: 자사 vs A사 vs B사 (마크다운 테이블, 5항목+)
4) 특허/IP 현황: 등록 ○건, 출원 ○건 + 핵심 특허 설명
5) 개발 계획: 단계별 목표 + KPI + 일정 (테이블)
6) 사업비 집행 계획: 항목별 산출근거 (단가×수량×기간)
7) AI/딥테크 활용: 모델, 데이터, 성능 지표 (해당 시)
8) 시제품/PoC/MVP 현황: 개발 단계 + 검증 결과
★ 핵심 섹션: 3,500~6,000자. 평가 배점 最高. 기술적 깊이가 핵심.`, section_order: 4 },
    { section_name: "성장전략(Scale-up)", guidelines: `사업화 및 성장 전략을 단계별로 상세히:
1) 비즈니스 모델: 수익원별 구조 + 예상 수익 테이블
2) 마케팅/영업 전략: 채널별 전략 + 예상 CAC/LTV
3) 경쟁사 분석: 시장 점유율 + 포지셔닝 분석
4) 해외 진출 전략: 타깃 국가 + 진입 방식 + 예상 매출
5) 투자유치 계획: 라운드별 금액/시기/용도
6) 사회적 가치: 고용 창출, ESG, 지역경제 기여 (수치)
7) 연도별 매출 목표 테이블 (3~5년)
8) 리스크 분석: 3개 이상 리스크 + 대응 전략 테이블
9) 추진 일정: 월별/분기별 간트차트 형식 테이블
★ 핵심 섹션: 3,500~6,000자. 실현가능한 숫자 기반 전략.`, section_order: 5 },
    { section_name: "팀 구성(Team)", guidelines: `팀 역량과 조직 체계를 상세히:
1) 대표자: 학력 + 경력(회사명/직급/년수) + 핵심 실적(수치) + 본 사업 연관성 (5~8문장)
2) 핵심 팀원 3~5명: 각각 학력+경력+실적+담당역할 (3~5문장씩)
3) 조직도: 텍스트 기반 또는 테이블로 부서/역할/인원 표시
4) 채용 계획: 시기별 채용 역할 + 인원수 + 요구역량 (테이블)
5) 협력기관/파트너: 기관명 + 협력 내용 + 증빙 (MoU, LoI)
6) 자문위원/멘토: 있는 경우 명시
★ 2,500~4,000자. 팀의 실행력을 수치로 증명.`, section_order: 6 },
  ],
  growth_package: [
    { section_name: "신청 및 일반현황", guidelines: `기업 일반현황 + 신청 개요:
1) 기업명, 대표자, 법인번호, 설립일, 소재지
2) 아이템명, 아이템 범주
3) 사업비 구성: 정부지원금/자부담/계 (테이블)
4) 성공환원형 여부 (해당 시)
5) 대표자 주요 이력 + 핵심 실적
★ 1,200~2,000자 (간략 섹션). 테이블 형식 중심.`, section_order: 1 },
    { section_name: "창업아이템 개요 및 사업화 계획 요약", guidelines: `아이템 소개 + 사업화 계획 요약:
1) 아이템명, 범주, 핵심 기술/특징 (3~5가지)
2) 제품/서비스 개요: 무엇을, 누구에게, 어떻게 + 차별점
3) 기존 사업화 실적: 매출, 고객, 투자, 수상 (수치)
4) 중장기 사업화 로드맵 (3~5년 요약)
5) 핵심 KPI 하이라이트 카드
★ 2,000~3,000자.`, section_order: 2 },
    { section_name: "사업화 과제 소개 및 차별성", guidelines: `사업화 과제의 핵심 내용과 차별성을 깊이 있게:
1) 사업화 과제 소개: 개발하려는 제품/서비스의 구체적 내용 + 목표
2) 기술 차별성: 기존 대비 ○○% 향상 (수치 필수, 3가지 이상)
3) 경쟁사 비교표: 자사 vs A사 vs B사 (5항목+ 마크다운 테이블)
4) 핵심 실적/성과: 매출 추이, 고객수, 투자유치, 특허, 수상
5) 특허/IP 현황: 등록/출원 현황 + 핵심 기술 보호 전략
6) AI/딥테크 활용: 모델, 데이터, 성능 (해당 시)
★ 핵심 섹션: 3,500~6,000자.`, section_order: 3 },
    { section_name: "국내외 목표시장", guidelines: `시장을 다층적으로 분석:
1) TAM/SAM/SOM: 금액+출처+연도+CAGR
2) 시장 트렌드: 성장 드라이버 3가지 + 정부 정책 방향
3) 경쟁 분석: 경쟁사 비교표 + 포지셔닝 분석
4) 목표 고객 세그먼트별 규모/특성/니즈
5) 해외 시장 진출 기회 분석
★ 핵심 섹션: 3,500~6,000자. 리서치 데이터 필수.`, section_order: 4 },
    { section_name: "사업추진전략", guidelines: `구체적 사업화 전략 + 추진 일정:
1) 비즈니스 모델: 수익원별 구조 + 예상 수익
2) 마케팅/영업 전략: 채널별 전략 + 목표 수치
3) 해외 진출: 타깃 국가 + 진입 방식 + 파트너십
4) 투자유치: 라운드별 계획
5) 추진 일정표: 월별/분기별 (마크다운 테이블)
6) 연도별 매출/수출 목표 테이블 (3~5년)
7) 리스크 분석: 3개+ 리스크 × 대응 전략
★ 핵심 섹션: 3,500~6,000자.`, section_order: 5 },
    { section_name: "사업비 집행 계획", guidelines: `항목별 사업비와 산출근거를 상세히:
1) 총괄 예산표: 정부지원금/자부담/계 (마크다운 테이블)
2) 항목별 산출근거: 단가 × 수량 × 기간 = 금액 (테이블)
3) 주요 비목: 인건비/재료비/외주용역비/기자재비/여비/특허비
4) 분기별 집행 계획
5) 자부담 재원 조달 방안
★ 2,000~3,000자. 산출근거 테이블 필수.`, section_order: 6 },
    { section_name: "팀 역량 및 채용 계획", guidelines: `팀의 역량을 구체적 실적으로 증명:
1) 대표자: 학력+경력+핵심실적(수치)+본사업연관성 (5~8문장)
2) 핵심 팀원 3~5명: 학력+경력+실적+담당역할
3) 조직도/업무분장 테이블
4) 채용 계획: 시기/역할/인원/요구역량/예상연봉 (테이블)
5) 파트너/협력기관: 기관명+협력내용+증빙
★ 2,500~4,000자.`, section_order: 7 },
  ],
  export_voucher: [
    { section_name: "수출마케팅 추진 계획", guidelines: `프로그램별 수출마케팅 계획:
1) 프로그램별 기간/정부보조금/기업부담금 (마크다운 테이블)
2) 수출 목표: 국가별/제품별 목표 수출액
3) 추진 일정: 월별 활동 계획
★ 2,000~3,000자.`, section_order: 1 },
    { section_name: "기업현황", guidelines: `기업 일반현황 + 수출 실적:
1) 회사명, 설립일, 주생산품, 업종
2) 매출액 3년 추이 (마크다운 테이블)
3) 수출액 3년 추이 + 수출 비중
4) 주요 수출 국가/거래처
★ 2,000~3,000자.`, section_order: 2 },
    { section_name: "제품 현황 및 수출필요성", guidelines: `제품과 수출 필요성:
1) 생산품목 상세 + 개발현황
2) 국내외 시장규모 (TAM/SAM/SOM)
3) 경쟁업체 분석 + 비교표
4) 수출 필요성: 왜 해외시장 진출이 필요한지
★ 3,000~5,000자.`, section_order: 3 },
    { section_name: "수출마케팅 세부 추진 계획", guidelines: `국가별/채널별 수출 전략:
1) 해외시장 분석: 국가별 시장 규모/트렌드/진입 장벽
2) 목표 수출액: 국가별/제품별 (테이블)
3) 수출전략: 채널별 (바이어/전시회/온라인/에이전트)
4) 기확보 거래처 + 신규 개척 계획
★ 3,000~5,000자.`, section_order: 4 },
  ],
};
