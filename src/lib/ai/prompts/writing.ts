/**
 * 사업계획서 자동 작성 프롬프트 — 3단계 공정 고도화 v3
 * Stage 0: 양식 인식 + 자동 분류 + 평가 기준 추출
 * Stage 1: 텍스트 초안 (선정 패턴 + 리서치 + 품질 검증)
 * Stage 2: 인포그래픽/차트 데이터 추출
 */

// ========================================
// Pre-Stage: 공고 양식 PDF OCR
// ========================================

export const PROGRAM_PDF_OCR_SYSTEM = `당신은 정부지원사업 공고문/신청서 양식 전문 OCR 도우미입니다.

# 목표
PDF에서 사업계획서 작성에 필요한 모든 텍스트를 정확하게 추출합니다.

# 추출 원칙
1. 표(table)의 셀 내용을 행/열 구조를 유지하여 추출
2. 섹션 제목과 번호 체계를 정확히 보존 (1., 1-1., 가., (1) 등)
3. 작성 지침/가이드라인 텍스트를 빠짐없이 포함
4. 평가 항목과 배점 표를 정확히 추출
5. 양식 필드 이름과 설명을 포함 (빈 칸의 라벨)
6. 페이지 번호, 머리글/바닥글, 워터마크는 생략
7. 이미지/로고 설명은 생략

# 출력 형식
- 마크다운 형식으로 출력
- 섹션 구분은 ## 헤더 사용
- 표는 마크다운 테이블 사용
- 작성 지침은 > 블록인용 사용`;

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
  | "small_business"
  | "policy_fund"
  | "rnd_project"
  | "custom";

export const TEMPLATE_CLASSIFIER_SYSTEM = `사업계획서 양식 OCR 텍스트를 분석하여 어떤 정부지원사업 유형인지 분류하세요.

# 분류 기준 (우선순위 높은 것부터 매칭)

## 1차: 명확한 키워드 매칭
- startup_package: "초기창업패키지", "예비창업패키지" 또는 Problem/Solution/Scale-up/Team 4섹션 구조
- growth_package: "창업도약패키지", "민관공동창업자발굴육성", "사내벤처육성" 또는 사업화실적 강조 구조
- dips: "초격차 스타트업", "DIPS", "딥테크" 키워드
- export_voucher: "수출바우처", "수출지원기반활용", "해외마케팅사업" 키워드
- sme_fund: "중소기업진흥공단", "청년창업사관학교", "청년창업전용자금", "중진공" 키워드
- innovation_growth: "혁신성장", "기술혁신형", "이노비즈", "메인비즈" 키워드
- small_business: "소상공인", "소공인", "전통시장", "생활혁신", "자영업", "골목상권" 키워드
- policy_fund: "정책자금", "시설자금", "운전자금", "직접대출", "중소벤처기업부 융자" 키워드
- rnd_project: "연구개발", "R&D", "기술개발사업", "과제신청서", "연구계획서", "산업기술", "IITP", "KIAT" 키워드

## 2차: 구조/맥락 기반 분류
- startup_package: 창업 3~7년 이내 + 4~6섹션 구조 + "아이템" 표현 빈출
- growth_package: 기존 매출/실적 강조 + 도약/성장 표현 + 6~8섹션
- dips: 딥테크/원천기술 + 기술이전 + 고위험 고성장
- export_voucher: 수출/해외/바이어/전시회 + 무역 실적
- sme_fund: 중소기업 + 자금용도 + 상환계획 + 담보/보증
- innovation_growth: 혁신/기술경쟁력 + 인증 + R&D투자
- small_business: 소규모 창업 + 점포/상권 + 일매출 + 메뉴/상품
- policy_fund: 대출/융자 + 자금소요 + 상환 + 신용등급
- rnd_project: 연구목표/방법/결과 + TRL + 참여연구원 + 연구비 + M/M
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
  // 앞부분 + 뒷부분을 함께 보내서 분류 정확도 향상
  const head = ocrText.slice(0, 2500);
  const tail = ocrText.length > 3000 ? `\n\n... (중략) ...\n\n${ocrText.slice(-1500)}` : "";
  return `OCR 텍스트:\n${head}${tail}\n\n이 양식은 어떤 정부지원사업 유형인가요?`;
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
  small_business: [
    { 항목: "사업아이디어", 배점: 30 },
    { 항목: "사업운영역량", 배점: 25 },
    { 항목: "시장분석", 배점: 25 },
    { 항목: "자금운용계획", 배점: 20 },
  ],
  policy_fund: [
    { 항목: "사업타당성", 배점: 30 },
    { 항목: "기술혁신성", 배점: 25 },
    { 항목: "자금운용계획", 배점: 25 },
    { 항목: "경영역량", 배점: 20 },
  ],
  rnd_project: [
    { 항목: "기술개발계획", 배점: 35 },
    { 항목: "기술차별성", 배점: 25 },
    { 항목: "사업화전략", 배점: 20 },
    { 항목: "연구역량", 배점: 20 },
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

// 3-1. 리서치 판단 + 검색 쿼리 통합 (2회→1회 호출 최적화)
export const RESEARCH_JUDGE_WITH_QUERY_SYSTEM = `주어진 사업계획서 섹션의 작성에 외부 리서치(시장 데이터, 통계, 트렌드 등)가 필요한지 판단하고, 필요하면 검색 쿼리도 함께 생성하세요.

# 판단 기준
- 시장 규모, 성장률, 트렌드 등 외부 데이터가 필요하면 needs_research: 1
- 회사 내부 정보(기술, 팀, 일정 등)만으로 충분하면 needs_research: 0

# 출력 형식
\`\`\`json
{
  "needs_research": 1,
  "ko": "한국어 검색 쿼리 (needs_research가 0이면 빈 문자열)",
  "en": "English search query (needs_research가 0이면 빈 문자열)"
}
\`\`\`

JSON만 출력하세요. 검색어는 구체적이고 최신 데이터를 찾을 수 있도록 작성하세요.`;

export function buildResearchJudgeWithQueryPrompt(
  sectionName: string,
  guidelines: string,
  businessContent: string
) {
  return `섹션명: ${sectionName}
작성지침: ${guidelines || "없음"}
회사 사업 분야: ${businessContent.slice(0, 300)}

이 섹션을 작성하려면 외부 시장 리서치가 필요한가요? 필요하다면 한국어/영어 검색 쿼리도 함께 생성하세요.`;
}

// 4. 검색 쿼리 생성 (Haiku) — 단독 사용 시 (하위호환)
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

// 6-1. 품질 검증 + 차트 데이터 추출 통합 (2회→1회 호출 최적화)
export const QUALITY_AND_CHART_SYSTEM = `작성된 사업계획서 섹션에 대해 두 가지 작업을 수행하세요:
1) 품질 평가 (100점 만점)
2) 차트/인포그래픽 데이터 추출

# 품질 평가 항목 (각 항목 10점)
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

grade 기준: A(90+), B(80+), C(70+), D(60+), F(60미만)

# 차트 추출 대상 (주요 유형)
bar, pie, line, tam_sam_som, comparison_table, timeline, highlight_cards, pain_points, tco_comparison, revenue_model, org_chart, ecosystem_map, esg_cards, step_roadmap

# 출력 형식
\`\`\`json
{
  "quality": {
    "scores": { "숫자_기반_실적": 8, "TAM_SAM_SOM": 7, ... },
    "total": 71,
    "grade": "B",
    "char_count": 3250,
    "improvements": ["개선사항1"],
    "strengths": ["강점1"]
  },
  "charts": [
    {
      "chart_type": "bar",
      "title": "차트 제목",
      "data": { ... },
      "priority": "high"
    }
  ]
}
\`\`\`

해당 섹션에 적합하지 않은 품질 항목은 N/A로 처리하고 점수 계산에서 제외하세요.
시각화 가능한 데이터가 없으면 charts는 빈 배열로 반환하세요.
섹션당 차트는 2~3개만 추출하세요. 최대 4개를 넘기지 마세요. 가장 핵심적인 데이터만 선별하세요.
JSON만 출력하세요.`;

export function buildQualityAndChartPrompt(
  sectionName: string,
  content: string,
  templateType?: TemplateType
) {
  return `## 대상 섹션
섹션명: ${sectionName}
양식유형: ${templateType || "custom"}

## 작성된 내용
${content}

위 사업계획서 섹션의 품질을 평가하고, 차트/인포그래픽으로 시각화할 데이터를 추출하세요.`;
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
- ⚠️ **[회사에서 입력 필요] 표시 최소화**: 회사 정보에서 추론 가능한 내용은 적극적으로 활용하세요. 매출, 직원수, 업종, 제품, 실적 등 프로필에 있는 정보를 최대한 활용하여 구체적으로 작성하세요. 정말로 프로필에 전혀 없는 정보(예: 특정 직원 이름, 구체적 특허번호)만 [추가 입력 필요]로 표시하세요.
- ⚠️ 절대 분량을 줄이지 마세요. 충분히 상세하게 작성하세요.
- ⚠️ **공고 일치성**: 지원사업 공고 정보가 제공된 경우, 공고의 지원대상/자격요건/평가기준에 맞춰 내용을 구성하세요. 공고와 무관한 내용을 작성하지 마세요.`;

export function buildSectionWriterPrompt(opts: {
  sectionName: string;
  guidelines: string;
  businessContent: string;
  programInfo?: string;
  previousSections: string;
  evaluationWeight?: number;
  researchKo?: string;
  researchEn?: string;
  templateType?: TemplateType;
  referenceExamples?: string;
  evaluationCriteria?: Array<{ 항목: string; 배점: number; 세부기준?: string }>;
  userPrompt?: string;
}) {
  let prompt = `# 작성 대상 섹션
**섹션명**: ${opts.sectionName}
**작성 지침**: ${opts.guidelines || "자유 서술"}
${opts.evaluationWeight ? `**평가 배점**: ${opts.evaluationWeight}점 (높은 배점 → 더 상세히 작성)` : ""}
${opts.templateType ? `**양식 유형**: ${opts.templateType}` : ""}

# 회사 정보 (인터뷰 기반 프로필)
${opts.businessContent}`;

  // 프로그램 정보를 별도 섹션으로 명확하게 분리하여 주입
  if (opts.programInfo) {
    prompt += `

# ⚠️ 지원사업 공고 정보 (반드시 반영!)
아래는 이 사업계획서가 지원하는 정부지원사업 공고입니다.
**사업계획서의 모든 내용은 이 공고의 지원대상, 자격요건, 지원내용에 정확히 부합해야 합니다.**
공고에서 요구하는 항목, 평가기준, 자격요건을 빠짐없이 반영하세요.

${opts.programInfo}`;
  }

  prompt += `

# 이미 작성된 앞 섹션들
${opts.previousSections || "(첫 번째 섹션)"}`;

  if (opts.researchKo || opts.researchEn) {
    prompt += `\n\n# 시장 리서치 데이터 (활용 지침)
아래는 외부 시장조사 결과입니다. 다음 규칙에 따라 활용하세요:

## 활용 규칙
1. **핵심 수치만 추출**: 시장 규모, 성장률, 점유율 등 정량 데이터를 근거로 활용
2. **출처 반드시 명시**: "~에 따르면", "~자료에 의하면", "~(출처, 연도)" 형식으로 인용
3. **관련성 판단**: 리서치 내용이 이 섹션과 직접 관련 없으면 인용하지 마세요
4. **사실만 인용**: 리서치 데이터의 의견/전망은 참고만 하고, 수치/통계만 인용
5. **자연스러운 통합**: 리서치 데이터를 별도 블록으로 나열하지 말고 논리 흐름에 자연스럽게 녹여 쓰세요

${opts.researchKo ? `## 한국어 리서치 데이터\n${opts.researchKo}` : ""}
${opts.researchEn ? `## 영어 리서치 데이터\n${opts.researchEn}` : ""}`;
  }

  if (opts.referenceExamples) {
    prompt += `\n\n# 선정된 사업계획서 레퍼런스 (실제 선정 사례)
아래는 실제 선정된 사업계획서에서 이 섹션과 유사한 내용입니다.
문체, 구조, 깊이를 참고하되 내용을 그대로 복사하지 마세요.

${opts.referenceExamples}`;
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

  // 평가 기준 연동 (A4: 이 섹션에 해당하는 평가 항목 안내)
  if (opts.evaluationCriteria && opts.evaluationCriteria.length > 0) {
    const relevantCriteria = opts.evaluationCriteria.filter((c) => {
      const sectionLower = opts.sectionName.toLowerCase();
      const criteriaLower = c.항목.toLowerCase();
      // 섹션명과 평가항목명의 키워드 매칭
      return (
        sectionLower.includes(criteriaLower) ||
        criteriaLower.includes(sectionLower.replace(/[()（）]/g, "")) ||
        // 부분 키워드 매칭
        criteriaLower.split(/[\s/·,]/).some((k: string) => k.length >= 2 && sectionLower.includes(k)) ||
        sectionLower.split(/[\s/·,()（）]/).some((k: string) => k.length >= 2 && criteriaLower.includes(k))
      );
    });

    if (relevantCriteria.length > 0) {
      const criteriaText = relevantCriteria.map((c) =>
        `- **"${c.항목}"** (배점: ${c.배점}점)${c.세부기준 ? ` — ${c.세부기준}` : ""}`
      ).join("\n");

      prompt += `\n\n# ⚠️ 선정 평가 기준 (이 섹션 해당 항목)
이 섹션은 아래 평가 기준에 직접 영향을 받습니다. 평가위원이 이 기준으로 채점합니다.
각 기준의 세부 요구사항을 빠짐없이 충족하도록 작성하세요.

${criteriaText}`;
    }
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

  // 사용자 프롬프트 (재생성 시 사용자가 입력한 수정 지시사항)
  if (opts.userPrompt) {
    prompt += `\n\n# ⚠️ 사용자 수정 요청 (최우선 반영)
아래는 사용자가 직접 입력한 수정 지시사항입니다.
이 지시사항을 **최우선으로 반영**하여 섹션을 다시 작성하세요.
기존 작성 지침과 품질 기준을 유지하면서 사용자 요청을 충족시켜야 합니다.

**수정 요청**: ${opts.userPrompt}`;
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
- 섹션당 2~3개만 추출하세요. 최대 4개를 넘기지 마세요. 가장 핵심적이고 임팩트 있는 데이터만 선별하세요.
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

// ===== 사용자 프롬프트 기반 차트 커스터마이징 =====

export const CHART_CUSTOMIZER_SYSTEM = `사용자의 요청에 따라 기존 차트 데이터를 수정하거나 새로운 차트를 생성하세요.

# 역할
- 사용자가 특정 차트를 수정하고 싶을 때: 데이터 변경, 스타일 변경, 차트 타입 변경 등
- 사용자가 새 차트를 추가하고 싶을 때: 섹션 내용 기반으로 새 인포그래픽 생성
- 사용자가 차트를 더 임팩트 있게 만들고 싶을 때: 핵심 수치 강조, 레이아웃 최적화

# 지원 차트 타입 (14개)
1. bar: 막대차트 (매출 추이, 비교 데이터)
2. pie: 파이차트 (구성 비율)
3. line: 선그래프 (성장 추이)
4. tam_sam_som: 동심원차트 (시장 규모)
5. comparison_table: 비교테이블
6. timeline: 타임라인
7. highlight_cards: 핵심 KPI 수치 카드
8. pain_points: 문제점 다이어그램
9. tco_comparison: 비용 비교 (기존 vs 도입 후)
10. revenue_model: 수익 모델 구조도
11. org_chart: 조직도
12. ecosystem_map: 협력 생태계 맵
13. esg_cards: ESG 성과 카드
14. step_roadmap: 단계별 로드맵

# 커스터마이징 유형별 대응
- "차트 타입 바꿔줘" → 같은 데이터로 다른 chart_type 생성
- "수치 강조해줘" → highlight_cards로 핵심 수치 추출
- "비교 차트로" → comparison_table 또는 tco_comparison으로 변환
- "더 임팩트 있게" → 핵심 수치만 추출 + highlight_cards 조합
- "막대그래프로" → bar 차트로 변환
- "파이차트로" → pie 차트로 변환
- "시각적으로 강화" → 기존 차트에 더 다양한 데이터 추가 또는 정리
- "새로 만들어줘" → 섹션 내용 재분석하여 새 차트 생성

# 규칙
- 항상 데이터의 정확성 유지 (원본 섹션 내용의 수치 그대로 활용)
- 차트 제목은 임팩트 있게 (수치를 포함한 제목 권장: "매출 275% 성장 추이" 등)
- 섹션 내용에 없는 데이터를 지어내지 말 것
- JSON만 출력하세요.`;

export function buildChartCustomizerPrompt(opts: {
  userPrompt: string;
  sectionName: string;
  sectionContent: string;
  existingCharts?: Array<Record<string, unknown>>;
  targetChartIndex?: number;
}) {
  let prompt = `## 사용자 요청\n${opts.userPrompt}\n\n`;
  prompt += `## 대상 섹션\n섹션명: ${opts.sectionName}\n\n`;
  prompt += `## 섹션 내용\n${opts.sectionContent}\n\n`;

  if (opts.existingCharts && opts.existingCharts.length > 0) {
    prompt += `## 기존 차트 데이터\n`;
    if (opts.targetChartIndex !== undefined && opts.existingCharts[opts.targetChartIndex]) {
      prompt += `수정 대상 차트:\n\`\`\`json\n${JSON.stringify(opts.existingCharts[opts.targetChartIndex], null, 2)}\n\`\`\`\n\n`;
      prompt += `기타 차트 (${opts.existingCharts.length - 1}개):\n`;
      opts.existingCharts.forEach((c, i) => {
        if (i !== opts.targetChartIndex) {
          prompt += `- ${(c as { chart_type?: string }).chart_type}: ${(c as { title?: string }).title}\n`;
        }
      });
    } else {
      prompt += `\`\`\`json\n${JSON.stringify(opts.existingCharts, null, 2)}\n\`\`\`\n`;
    }
    prompt += `\n`;
  }

  prompt += `사용자 요청에 맞게 차트를 수정하거나 새로 생성하세요. 결과는 기존과 동일한 JSON 형식으로 출력하세요.\n`;
  prompt += `\`\`\`json\n{ "charts": [...] }\n\`\`\``;

  return prompt;
}

// ===== 차트 추천 프리셋 (UI에서 사용) =====
export const CHART_PRESETS: Array<{
  id: string;
  label: string;
  description: string;
  icon: string;
  suggestedTypes: string[];
  promptTemplate: string;
}> = [
  {
    id: "market_impact",
    label: "시장 임팩트 강화",
    description: "TAM/SAM/SOM + 시장 성장률 수치 강조",
    icon: "📊",
    suggestedTypes: ["tam_sam_som", "highlight_cards", "bar"],
    promptTemplate: "시장 규모와 성장성을 강조하는 임팩트 있는 인포그래픽을 만들어줘. TAM/SAM/SOM과 핵심 수치를 부각시켜줘.",
  },
  {
    id: "competitive_edge",
    label: "경쟁 우위 시각화",
    description: "경쟁사 비교표 + 차별점 하이라이트",
    icon: "🏆",
    suggestedTypes: ["comparison_table", "highlight_cards", "pain_points"],
    promptTemplate: "경쟁사 대비 우리 기업의 차별점을 명확히 보여주는 비교 인포그래픽을 만들어줘.",
  },
  {
    id: "financial_growth",
    label: "재무 성장 스토리",
    description: "매출 추이 + 수익 모델 + 핵심 재무 KPI",
    icon: "💰",
    suggestedTypes: ["bar", "line", "revenue_model", "highlight_cards"],
    promptTemplate: "매출 성장과 수익 모델을 시각적으로 보여주는 차트를 만들어줘. 핵심 재무 수치를 강조해줘.",
  },
  {
    id: "tech_roadmap",
    label: "기술 개발 로드맵",
    description: "단계별 기술 발전 + 마일스톤 타임라인",
    icon: "🚀",
    suggestedTypes: ["step_roadmap", "timeline", "highlight_cards"],
    promptTemplate: "기술 개발 로드맵과 단계별 마일스톤을 시각적으로 보여주는 인포그래픽을 만들어줘.",
  },
  {
    id: "cost_saving",
    label: "비용 절감 효과",
    description: "기존 vs 도입 후 TCO 비교 + 절감율",
    icon: "⚡",
    suggestedTypes: ["tco_comparison", "highlight_cards", "bar"],
    promptTemplate: "기존 방식 대비 비용 절감 효과를 임팩트 있는 비교 인포그래픽으로 만들어줘. 구체적인 절감 수치를 강조해줘.",
  },
  {
    id: "team_ecosystem",
    label: "팀 & 생태계",
    description: "조직도 + 협력 생태계 + 팀 역량 수치",
    icon: "👥",
    suggestedTypes: ["org_chart", "ecosystem_map", "highlight_cards"],
    promptTemplate: "팀 구성과 협력 생태계를 보여주는 인포그래픽을 만들어줘. 핵심 인력의 역량을 강조해줘.",
  },
];

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
  innovation_growth: [
    { section_name: "기업 및 기술 현황", guidelines: `기업 개요와 핵심 기술 역량:
1) 기업명, 대표자, 설립일, 업종, 소재지
2) 주요 사업 분야 + 매출 추이 3년 (테이블)
3) 보유 핵심 기술 목록 + 기술등급(특허/인증)
4) R&D 투자 현황: 연도별 R&D 투자비 (테이블)
5) 주요 성과: 수상, 인증, 매출 실적 (수치)
★ 2,000~3,000자.`, section_order: 1 },
    { section_name: "기술혁신 과제 소개", guidelines: `혁신 기술의 구체적 내용:
1) 기술개발 과제명 + 분류(핵심/응용/파생)
2) 기술 개요: 작동 원리 + 핵심 알고리즘/메커니즘 (3~5문장)
3) 핵심 기술 차별점 3가지 이상 (수치화: ○○% 향상/○배 절감)
4) 기술 성숙도(TRL) 현재 단계 + 목표 단계
5) 관련 특허/IP: 등록 ○건, 출원 ○건 + 핵심 특허 설명
6) 국내외 기술 동향 비교 분석
★ 핵심 섹션: 3,500~6,000자. 기술적 깊이가 핵심.`, section_order: 2 },
    { section_name: "시장 분석 및 사업성", guidelines: `시장 규모와 사업 타당성:
1) TAM/SAM/SOM: 금액+출처+연도+CAGR
2) 국내외 시장 트렌드: 성장 동인 3가지
3) 경쟁사 비교표: 자사 vs A사 vs B사 vs C사 (마크다운 테이블, 5항목+)
4) 고객 세그먼트별 규모/니즈 분석
5) 비즈니스 모델: 수익원 구조 + 예상 수익 테이블
6) 예상 매출 로드맵 (3~5년, 테이블)
★ 핵심 섹션: 3,500~6,000자. 데이터 기반 분석 필수.`, section_order: 3 },
    { section_name: "성장전략 및 추진 계획", guidelines: `구체적 성장 로드맵:
1) 기술개발 추진 일정: 단계별 목표+KPI (마크다운 테이블)
2) 마케팅/영업 전략: 채널별 전략 + 목표 수치
3) 해외 진출 계획: 타깃 국가 + 진입 방식
4) 투자유치/자금조달 계획: 라운드별 시기/금액/용도
5) 사회적 가치: 고용 창출, ESG, 지역경제 기여 (수치)
6) 리스크 분석: 3개+ 리스크 × 대응 전략 (테이블)
★ 핵심 섹션: 3,500~6,000자.`, section_order: 4 },
    { section_name: "사업비 집행 계획", guidelines: `항목별 예산과 산출근거:
1) 총괄 예산표: 정부지원금/자부담/계 (마크다운 테이블)
2) 항목별 산출근거: 단가 × 수량 × 기간 = 금액 (테이블)
3) 주요 비목 상세: 인건비/재료비/외주용역비/기자재비
4) 분기별 집행 계획
★ 2,000~3,000자. 산출근거 테이블 필수.`, section_order: 5 },
    { section_name: "팀 역량 및 조직 체계", guidelines: `팀의 기술역량과 실행력:
1) 대표자: 학력+경력+핵심실적(수치)+본사업연관성 (5~8문장)
2) 핵심 연구인력 3~5명: 학력+경력+실적+담당역할
3) 조직도/업무분장 (테이블)
4) 채용 계획: 시기/역할/인원/요구역량 (테이블)
5) 외부 협력기관/자문위원 현황
★ 2,500~4,000자.`, section_order: 6 },
  ],
  small_business: [
    { section_name: "창업(사업) 아이디어 개요", guidelines: `소상공인 창업 아이디어를 명확하게:
1) 사업 아이디어명 + 업종 분류
2) 사업 동기: 왜 이 사업을 시작하는지 (고객 경험, 시장 기회)
3) 제품/서비스 개요: 무엇을, 누구에게, 어떻게 (3~5문장)
4) 핵심 차별점 3가지 (기존 대비 개선점)
5) 예상 고객층: 연령/지역/소득 수준별 타깃
6) 예상 가격 전략 + 경쟁 가격 비교
★ 2,000~3,000자. 실현가능한 아이디어 중심.`, section_order: 1 },
    { section_name: "사업 운영 계획", guidelines: `일상적 운영의 구체적 계획:
1) 입지 분석: 예정 위치 + 상권 분석 (유동인구, 경쟁점 수)
2) 점포/공간 구성: 평수, 인테리어, 설비 목록 (테이블)
3) 인력 계획: 필요 인원 × 직무 × 급여 (테이블)
4) 운영 프로세스: 일일 운영 흐름도
5) 공급처/원재료 조달 계획
6) 위생/안전/법규 준수 사항
★ 2,500~4,000자.`, section_order: 2 },
    { section_name: "시장 분석 및 마케팅 전략", guidelines: `소상공인 시장 분석:
1) 상권 분석: 반경 500m/1km 경쟁점 현황
2) 타깃 고객 분석: 주요 고객층 특성 + 소비 패턴
3) 경쟁 분석: 주변 경쟁점 3~5곳 비교 (테이블)
4) 마케팅 전략: SNS/배달앱/지역광고 등 채널별 계획
5) 프로모션 계획: 오픈 이벤트, 멤버십, 시즌별 전략
6) 목표 매출: 일 매출 → 월 매출 → 연 매출 (테이블)
★ 핵심 섹션: 3,000~5,000자.`, section_order: 3 },
    { section_name: "자금 운용 계획", guidelines: `창업 자금과 운영 비용:
1) 초기 창업 비용: 보증금/인테리어/설비/원재료/기타 (테이블)
2) 자금 조달: 자기자본/대출/정부지원금 구성 (테이블)
3) 월 고정비: 임대료/인건비/공과금/기타 (테이블)
4) 손익분기점 분석: 월 BEP 매출 계산
5) 1~3년 수익 전망 (테이블)
6) 정부지원금 사용 계획: 항목별 금액+용도
★ 2,500~4,000자. 현실적 숫자 필수.`, section_order: 4 },
  ],
  policy_fund: [
    { section_name: "기업 개요 및 현황", guidelines: `기업 일반 정보와 경영 현황:
1) 기업명, 대표자, 설립일, 업종, 소재지
2) 매출 추이 3~5년 (테이블)
3) 재무 현황: 자산/부채/자본 (테이블)
4) 주요 사업 분야 + 제품/서비스
5) 고용 현황: 정규직/비정규직 (테이블)
6) 보유 인증/특허/수상 현황
★ 2,000~3,000자.`, section_order: 1 },
    { section_name: "자금 소요 및 사업 계획", guidelines: `자금의 용도와 사업 타당성:
1) 자금 신청 금액 + 용도 (테이블)
2) 사업 목적: 시설투자/운전자금/기술개발 등
3) 투자 계획: 항목별 금액 + 기대 효과 (테이블)
4) 예상 매출 증가: 투자 전후 비교 (테이블)
5) 사업 추진 일정: 분기별 활동 계획
6) 자금 상환 계획: 연도별 상환 스케줄
★ 핵심 섹션: 3,000~5,000자. 자금 용도의 타당성이 핵심.`, section_order: 2 },
    { section_name: "기술혁신 및 경쟁력", guidelines: `보유 기술과 시장 경쟁력:
1) 핵심 기술/제품 설명 + 차별점
2) 기술 개발 이력 + 향후 R&D 계획
3) 시장 분석: TAM/SAM/SOM (출처 포함)
4) 경쟁사 비교 (테이블, 3사 이상)
5) 특허/인증 현황 + 지적재산권 보호 전략
6) 해외 수출 실적/계획 (해당 시)
★ 핵심 섹션: 3,000~5,000자.`, section_order: 3 },
    { section_name: "경영역량 및 성장전략", guidelines: `대표자와 팀의 역량:
1) 대표자 이력: 학력+경력+핵심성과 (5~8문장)
2) 핵심 인력 현황 (테이블)
3) 경영 성과: 최근 3년 주요 실적 (수치)
4) 성장 전략: 단기(1년)/중기(3년)/장기(5년) 목표
5) 고용 창출 계획 + 지역경제 기여
6) 리스크 요인 + 대응 전략 (테이블)
★ 2,500~4,000자.`, section_order: 4 },
  ],
  rnd_project: [
    { section_name: "연구개발 과제 개요", guidelines: `R&D 과제의 전체 개요:
1) 과제명 + 연구 분야 + 기술 분류
2) 연구 목표: 최종 목표 + 연차별 세부 목표
3) 연구 필요성: 기술적 한계 + 시장 수요 + 정책 방향
4) 기술 현황: 국내외 기술 수준 비교 (테이블)
5) 선행 연구 분석: 관련 문헌/특허 검토 (5건+)
6) 연구 범위: 포함/제외 사항 명시
★ 2,500~4,000자.`, section_order: 1 },
    { section_name: "연구개발 내용 및 방법", guidelines: `기술개발의 핵심 내용:
1) 핵심 기술 설명: 작동 원리 + 기술 아키텍처
2) 연구개발 내용: 세부 기술 항목별 개발 내용 (3~5항목)
3) 연구 방법론: 실험/시뮬레이션/프로토타입 등
4) 기술 차별성: 기존 대비 성능 향상 수치 (3가지+)
5) 핵심 알고리즘/설계/소재 상세 설명
6) 시제품/PoC 개발 계획 + 검증 방법
7) 기술적 위험 요소 + 극복 방안 (테이블)
★ 핵심 섹션: 4,000~7,000자. 기술 깊이가 최우선.`, section_order: 2 },
    { section_name: "연구개발 추진 전략 및 일정", guidelines: `체계적 추진 계획:
1) 추진 체계: 주관기관/참여기관/위탁기관 역할 (테이블)
2) 연차별 추진 일정: 간트차트 형식 (마크다운 테이블)
3) 마일스톤: 단계별 목표 + 정량적 성과 지표
4) 품질 관리 계획: 기술 검증 방법 + 기준
5) 인력 투입 계획: 참여 연구원별 투입 M/M (테이블)
6) 연구 장비/시설 활용 계획
★ 3,000~5,000자.`, section_order: 3 },
    { section_name: "사업화 전략 및 기대효과", guidelines: `R&D 성과의 사업화:
1) 사업화 전략: 기술이전/직접사업화/라이선싱
2) 목표 시장: TAM/SAM/SOM + 예상 점유율
3) 매출 전망: 3~5년 연도별 (테이블)
4) 사업화 일정: 개발 완료 → 양산 → 시장 진입 로드맵
5) 경제적 기대효과: 매출/고용/수출 (수치)
6) 기술적 기대효과: 국내 기술 수준 향상 효과
7) 사회적 기대효과: ESG/탄소중립/지역경제
★ 3,000~5,000자.`, section_order: 4 },
    { section_name: "연구비 산출 내역", guidelines: `항목별 연구비와 산출근거:
1) 총괄 예산표: 정부출연금/기업부담금(현금+현물)/계 (테이블)
2) 인건비: 참여 연구원별 등급×참여율×기간 (테이블)
3) 직접비: 재료비/외주용역비/기자재비/여비 각각 산출근거
4) 간접비: 기관부담금 산출 기준
5) 연차별 연구비 배분 (테이블)
6) 장비 구입 사유서 (해당 시)
★ 2,500~4,000자. 산출근거 테이블 필수.`, section_order: 5 },
    { section_name: "연구팀 구성 및 역량", guidelines: `연구팀의 전문성 증명:
1) 총괄 연구책임자(PM): 학력+경력+수행실적(수치) (5~8문장)
2) 참여 연구원 5~10명: 학력+경력+전공+역할 (각 3~5문장)
3) 참여기관별 역할 분담 (테이블)
4) 연구 인프라: 보유 장비/시설/인증 (테이블)
5) 외부 자문위원/협력기관 현황
6) 과제 수행 실적: 최근 3년 유사 과제 수행 이력
★ 3,000~5,000자.`, section_order: 6 },
  ],
};
