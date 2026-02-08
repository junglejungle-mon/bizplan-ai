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

// 5. 섹션 작성 (Sonnet — 핵심) — 선정 패턴 반영 v3
export const SECTION_WRITER_SYSTEM = `당신은 대한민국 정부지원사업 사업계획서 작성 전문가입니다.
실제 선정된 사업계획서 12건(초기창업패키지, 창업도약패키지, DIPS, 수출바우처, 중진공 자금)의 패턴을 학습하여 고득점 사업계획서를 작성합니다.

# 작성 규칙
1. 전문적이고 공식적인 어체 사용
2. 비즈니스 전문 용어 적절히 활용
3. 구조화된 형식과 목차 (번호, 불릿 포인트)
4. 간결하고 핵심적인 표현
5. 객관적이고 중립적인 어조
6. **개조식 어체** (명사형 종결: -음, -임, -함)
7. 평가 기준에서 배점이 높은 항목에 더 상세하게 작성
8. 구체적인 수치, 일정, 목표를 포함
9. 3인칭 서술 (당사, 본 사업 등)

# 선정 사업계획서 필수 패턴 (반드시 포함)
1. **숫자 기반 실적**: 모든 주장에 수치 근거 (매출 ○억, 성장률 ○%, 고객 ○명)
   ✅ "23년 매출 8억, 24년 30억 (전년 대비 275% 성장)"
   ❌ "빠르게 성장하고 있음" (구체적 수치 없음)
2. **TAM/SAM/SOM**: 시장 관련 섹션에 반드시 포함
   ✅ TAM: 글로벌 시장 695억달러 → SAM: 아시아 34.75억달러 → SOM: 자사 타깃 1,740만달러
3. **경쟁사 비교표**: 자사 vs 경쟁사 A vs B 비교 테이블
4. **구체적 로드맵**: 월별/분기별 추진 일정
5. **팀 역량**: 학력+경력(년수)+실적(수치)+해당사업 연관성
6. **리스크+대응**: 리스크 인지 + 구체적 대응 전략
7. **사회적 가치**: 고용창출, 탄소중립, ESG, 지역경제 기여

# 포맷
- 마크다운 형식으로 작성
- 소제목, 불릿 포인트, **표를 적극 활용** (비교/데이터 시각화)
- 핵심 수치는 **볼드** 처리
- 분량: 섹션당 600-1200자 (배점 높은 섹션은 1500자까지)
- 정보 부족 시 [회사에서 입력 필요] 표시`;

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

  // 선정 패턴 체크리스트 (섹션 유형별 맞춤)
  const sectionLower = opts.sectionName.toLowerCase();
  const checks: string[] = [];

  if (sectionLower.includes("시장") || sectionLower.includes("market") || sectionLower.includes("문제") || sectionLower.includes("problem") || sectionLower.includes("개요")) {
    checks.push("- TAM/SAM/SOM 시장 규모 반드시 포함 (구체적 금액 + 출처)");
    checks.push("- 시장 성장률(CAGR) 명시");
    checks.push("- 기존 제품/서비스의 구체적 한계점 수치화");
  }
  if (sectionLower.includes("경쟁") || sectionLower.includes("차별") || sectionLower.includes("기술") || sectionLower.includes("solution") || sectionLower.includes("실현")) {
    checks.push("- 경쟁사 비교표 포함 (자사 vs A사 vs B사)");
    checks.push("- 차별성을 수치로 표현 (○○% 향상, ○배 절감)");
    checks.push("- 특허/IP 보유/출원 현황 명시");
  }
  if (sectionLower.includes("전략") || sectionLower.includes("사업화") || sectionLower.includes("scale") || sectionLower.includes("로드맵") || sectionLower.includes("성장")) {
    checks.push("- 월별/분기별 상세 추진 일정표");
    checks.push("- 비즈니스 모델 수익 구조 설명");
    checks.push("- 단기/중기/장기 구분된 로드맵");
  }
  if (sectionLower.includes("팀") || sectionLower.includes("team") || sectionLower.includes("인력") || sectionLower.includes("조직")) {
    checks.push("- 핵심 인력: 학력+경력(년수)+실적(수치)");
    checks.push("- 채용 계획: 시기+역할+요구역량");
    checks.push("- 업무파트너/협력기관 현황");
  }
  if (sectionLower.includes("기대") || sectionLower.includes("효과") || sectionLower.includes("가치") || sectionLower.includes("예산") || sectionLower.includes("재무")) {
    checks.push("- 고용 창출 효과 (○명 신규 고용)");
    checks.push("- ESG/사회적 가치 (탄소중립, 순환경제 등)");
    checks.push("- 정량적 기대 효과 수치");
  }

  if (checks.length > 0) {
    prompt += `\n\n# 이 섹션 필수 체크리스트 (선정 패턴)\n${checks.join("\n")}`;
  }

  prompt += `\n\n위 정보를 바탕으로 "${opts.sectionName}" 섹션을 작성하세요. 마크다운 형식으로 출력하세요.`;

  return prompt;
}

// ========================================
// Stage 1.5: 품질 검증 (Validation)
// ========================================

// 6. 품질 점수 검증 (Haiku — 빠름)
export const QUALITY_VALIDATOR_SYSTEM = `작성된 사업계획서 섹션의 품질을 100점 만점으로 평가하세요.

# 평가 항목 (각 항목 10점)
1. 숫자_기반_실적: 매출/성장률/고객수 등 구체적 수치 포함 여부
2. TAM_SAM_SOM: 시장 규모 분석 포함 여부 (해당 섹션인 경우)
3. 경쟁사_비교: 경쟁사 비교 테이블 또는 분석 포함 여부
4. 구체적_로드맵: 월별/분기별 일정 포함 여부
5. 팀_역량_상세: 학력+경력+실적 포함 여부
6. 사업비_산출근거: 항목별 산출 근거 여부
7. 리스크_대응: 리스크 인지 + 대응 전략
8. 특허_IP: 출원번호 또는 계획 명시
9. 표_차트_활용: 마크다운 테이블 활용 여부
10. 분량_적정성: 600-1500자 범위 준수

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

// 7. 차트/데이터 추출 (Haiku — 빠름)
export const CHART_DATA_EXTRACTOR_SYSTEM = `작성된 사업계획서 섹션에서 차트/인포그래픽으로 시각화할 수 있는 데이터를 추출하세요.

# 추출 대상 데이터 유형
1. bar: 막대차트 (매출 추이, 비교 데이터)
2. pie: 파이차트 (구성 비율, 사업비 배분)
3. line: 선그래프 (성장 추이, 예측)
4. tam_sam_som: 동심원차트 (시장 규모)
5. comparison_table: 비교테이블 (경쟁사 비교)
6. timeline: 타임라인 (로드맵, 일정)
7. highlight_cards: 수치 하이라이트 카드 (핵심 KPI)

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
    }
  ]
}
\`\`\`

- 시각화 가능한 데이터가 없으면 빈 배열 반환
- priority: high(필수), medium(권장), low(선택)
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

// 9. 기본 섹션 템플릿 (양식 OCR이 없을 때)
export const DEFAULT_SECTIONS = [
  {
    section_name: "사업 개요",
    guidelines: "사업의 배경, 목적, 필요성을 기술. 해결하려는 문제와 시장 기회 제시. TAM/SAM/SOM 시장규모 포함.",
    section_order: 1,
  },
  {
    section_name: "기업 현황",
    guidelines: "기업 연혁, 조직 구성, 보유 기술/역량, 주요 실적 기술. 매출/고객 수치 포함.",
    section_order: 2,
  },
  {
    section_name: "기술 개발 내용",
    guidelines: "개발하려는 기술/제품의 핵심 내용, 차별성, 기술적 우위, 특허/IP 현황. 경쟁사 비교표 포함.",
    section_order: 3,
  },
  {
    section_name: "시장 분석",
    guidelines: "TAM/SAM/SOM 시장 규모, 목표 시장, 경쟁 분석, 시장 트렌드. CAGR 포함.",
    section_order: 4,
  },
  {
    section_name: "사업화 전략",
    guidelines: "제품화/서비스화 전략, 판로 개척, 마케팅, 수익 모델. 비즈니스 모델 플로우차트.",
    section_order: 5,
  },
  {
    section_name: "추진 일정",
    guidelines: "연차별/분기별 추진 계획, 마일스톤, 성과 지표. 간트차트 형식 권장.",
    section_order: 6,
  },
  {
    section_name: "소요 예산",
    guidelines: "항목별 예산 계획, 자부담/정부지원 비율, 투자 계획. 산출 근거 상세히.",
    section_order: 7,
  },
  {
    section_name: "기대 효과",
    guidelines: "기술적/경제적/사회적 기대 효과, 고용 창출, 매출 목표, ESG/사회적 가치.",
    section_order: 8,
  },
];

// 양식별 특화 기본 섹션 (OCR 실패 시 fallback)
export const TEMPLATE_SECTIONS: Partial<Record<TemplateType, typeof DEFAULT_SECTIONS>> = {
  startup_package: [
    { section_name: "일반현황", guidelines: "기업명, 대표자, 설립일, 팀 구성 현황, 총 사업비 구성", section_order: 1 },
    { section_name: "창업 아이템 개요(요약)", guidelines: "아이템명, 범주, 제품개요, 핵심기능, 고객혜택, 사양/가격. 2페이지 이내.", section_order: 2 },
    { section_name: "문제 인식(Problem)", guidelines: "국내외 시장 현황, 문제점, 기존 기술 한계, 개발 필요성. TAM/SAM/SOM.", section_order: 3 },
    { section_name: "실현 가능성(Solution)", guidelines: "개발 계획, 차별성, 경쟁력, 사업비 집행 계획, 특허/IP, AI 활용.", section_order: 4 },
    { section_name: "성장전략(Scale-up)", guidelines: "경쟁사 분석, 시장 진입 전략, BM, 투자유치, 로드맵, 사회적 가치.", section_order: 5 },
    { section_name: "팀 구성(Team)", guidelines: "대표자 역량, 팀원 보유역량, 채용 계획, 협력기관.", section_order: 6 },
  ],
  growth_package: [
    { section_name: "신청 및 일반현황", guidelines: "기업명, 대표자, 아이템명, 사업비 구성, 성공환원형 여부.", section_order: 1 },
    { section_name: "창업아이템 개요 및 사업화 계획 요약", guidelines: "아이템명, 범주, 주요 기술/특징, 중장기 로드맵. 2페이지 이내.", section_order: 2 },
    { section_name: "사업화 과제 소개 및 차별성", guidelines: "사업화 과제 소개, 차별성, 핵심 실적/성과 (매출, 고객, 투자).", section_order: 3 },
    { section_name: "국내외 목표시장", guidelines: "TAM/SAM/SOM, 시장분석, 경쟁사 분석, 포지셔닝.", section_order: 4 },
    { section_name: "사업추진전략", guidelines: "마케팅/영업 전략, 수익모델, 글로벌 진출, 투자유치.", section_order: 5 },
    { section_name: "사업비 집행 계획", guidelines: "항목별 사업비, 산출근거, 정부지원금/자부담 비율.", section_order: 6 },
    { section_name: "팀 역량 및 채용 계획", guidelines: "대표자 실적, 팀 전문성, 추가 채용, 파트너.", section_order: 7 },
  ],
  export_voucher: [
    { section_name: "수출마케팅 추진 계획", guidelines: "프로그램별 기간, 정부보조금, 기업부담금 테이블.", section_order: 1 },
    { section_name: "기업현황", guidelines: "회사명, 설립일, 주생산품, 매출액 3년 추이, 수출액 추이.", section_order: 2 },
    { section_name: "제품 현황 및 수출필요성", guidelines: "생산품목, 개발현황, 국내외 시장규모, 경쟁업체.", section_order: 3 },
    { section_name: "수출마케팅 세부 추진 계획", guidelines: "해외시장 분석, 목표 수출액, 수출전략, 거래처.", section_order: 4 },
  ],
};
