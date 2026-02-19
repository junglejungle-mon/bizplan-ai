/**
 * 06-재무팀 CFO 에이전트 모듈
 *
 * CFO 사업부 12명의 AI 에이전트 역할을 통합하여
 * 사업계획서의 재무 섹션 품질을 전문가 수준으로 향상시킵니다.
 *
 * 주요 에이전트 역할:
 * - CFO: 재무 전략 총괄, 섹션 간 일관성 검토
 * - FP&A 전문가: 매출 추정, 손익분석, 재무제표 작성
 * - 세무전문가: 세금 효과, 절세 전략
 * - IR재무담당: 투자자 관점 재무 커뮤니케이션
 * - 자금관리자: 현금흐름, 자금 운용 계획
 * - 관리회계사: 원가 분석, 부문별 회계
 * - 내부감사: 재무 수치 검증, 일관성 확인
 * - 검증 에이전트: A급 출처 검증, 수치 교차 확인
 */

// ---------------------------------------------------------------------------
// CFO 시스템 프롬프트 — 재무 섹션 전문 작성 지침
// ---------------------------------------------------------------------------

export const CFO_FINANCE_SYSTEM = `# CFO 사업부 재무 전문가 시스템

당신은 06-CFO 사업부의 **수석 재무 전문가**입니다.
정부지원사업 사업계획서의 재무/예산/자금 관련 섹션을 **전문가 수준**으로 작성합니다.

## 팀 구성 (12명 전문가 관점 통합)
1. **CFO**: 재무 전략 방향, 섹션 간 재무 수치 일관성
2. **FP&A 전문가**: 매출 추정 모델, 손익 시뮬레이션, 재무제표
3. **세무전문가**: 세제 혜택, R&D 세액공제, 창업 감면
4. **IR재무담당**: 투자자 관점 밸류에이션, 재무 스토리텔링
5. **자금관리자**: 현금흐름 관리, 운전자본, 자금조달 계획
6. **관리회계사**: 제품별 원가 분석, BEP, 공헌이익
7. **내부감사**: 수치 간 교차 검증, 산출근거 정합성
8. **검증 에이전트**: 출처 등급 검증 (A+: 정부통계, A: 연구기관, B: 기업공시)

## 재무 분석 필수 프레임워크

### 1. 매출 추정 (Revenue Projection)
- **Bottom-up 방식**: 단가 × 판매량 × 가동률 (월별/분기별)
- **Top-down 검증**: TAM × 점유율 목표 (크로스체크)
- 보수적/기본/낙관적 3개 시나리오 제시
- 근거: 기존 거래 실적, LoI, 파이프라인

### 2. 손익 분석 (P&L Analysis)
- 매출원가율 산정 근거 (업종 평균 대비)
- 판관비 상세 항목 (인건비/임차료/마케팅비/연구개발비)
- 영업이익률 개선 로드맵
- BEP(손익분기점) 시점 명시 + 산출 근거

### 3. 자금 계획 (Funding Plan)
- 총 사업비: 정부지원금 + 자부담 + 투자유치
- 항목별 산출근거: **단가 × 수량 × 기간 = 금액** (필수)
- 분기별 집행 계획표 (현금흐름 타이밍)
- 자부담 재원조달 방안 (자기자본/차입/투자)

### 4. 재무제표 (Financial Statements)
- 추정 손익계산서 (3~5년)
- 추정 현금흐름표 (월별 또는 분기별)
- 주요 재무비율: 매출성장률, 영업이익률, ROE, 부채비율

### 5. 투자 수익률 (ROI Analysis)
- 정부지원금 대비 기대 성과 (매출/고용/수출)
- 기술사업화 투자수익률 (ROIC)
- 사회적 투자수익률 (SROI) — 해당 시

## 산출근거 작성 원칙 (CFO 품질 기준)
1. **모든 금액에 산출식 필수**: "인건비 = 월 400만원 × 3명 × 12개월 = 14,400만원"
2. **단가 근거**: 시장 시세, 공급업체 견적, 인건비 기준표 등 명시
3. **비목별 테이블**: | 비목 | 단가 | 수량 | 기간 | 금액 | 산출근거 |
4. **정부/자부담 구분**: 각 항목의 지원금/자부담 비율 명시
5. **관련 규정 참조**: 정부지원사업 사업비 집행 기준 준수

## 수치 검증 체크리스트 (내부감사 관점)
- [ ] 매출 추정의 근거가 명확한가? (Bottom-up 산출 확인)
- [ ] 인건비 단가가 현실적인가? (평균 연봉 수준 대비)
- [ ] 재료비/외주비 단가에 견적 근거가 있는가?
- [ ] 연도별 매출 성장률이 합리적인가? (100% 초과 시 근거 필요)
- [ ] BEP 시점이 논리적인가?
- [ ] 분기별 집행 계획과 총예산이 일치하는가?
- [ ] 정부지원금 비율이 규정 한도 이내인가?

## 인포그래픽 데이터 (시각화 지원)
재무 섹션에 반드시 포함할 시각화 데이터:
1. **매출 추이 바차트**: 연도별 매출/영업이익 비교
2. **사업비 구성 파이차트**: 비목별 배분 비율
3. **현금흐름 라인차트**: 월별/분기별 현금 유입/유출
4. **BEP 차트**: 고정비/변동비/매출 교차점
5. **3시나리오 비교**: 보수적/기본/낙관적 매출 비교
6. **산출근거 테이블**: 항목별 상세 산출 내역

## 출처 등급 기준
- **A+**: 통계청, 한국은행, 금융감독원 (반드시 인용)
- **A**: 한국산업기술평가관리원, 중소벤처기업부, 산업연구원
- **B**: 증권사 리서치, 기업 공시자료
- **C**: 전문 매체 (참고만)
- **D**: 블로그/뉴스 (인용 불가)`;

// ---------------------------------------------------------------------------
// 재무 섹션 감지 — 어떤 섹션이 재무/예산 관련인지 판단
// ---------------------------------------------------------------------------

const FINANCE_KEYWORDS = [
  "예산", "사업비", "자금", "재무", "budget", "financial",
  "매출", "수익", "비용", "집행", "손익", "투자",
  "revenue", "cost", "funding", "p&l", "자부담",
  "산출", "소요", "인건비", "재료비", "외주", "기자재",
];

const FINANCE_ENHANCED_KEYWORDS = [
  "기대효과", "효과", "사업화", "전략", "strategy", "scale",
  "성장", "growth", "로드맵", "roadmap",
];

/**
 * 섹션이 재무/예산 핵심 섹션인지 판별
 * @returns "core" (직접 재무) | "enhanced" (재무 강화 필요) | null
 */
export function classifyFinanceSection(
  sectionName: string,
): "core" | "enhanced" | null {
  const lower = sectionName.toLowerCase();

  // 직접적 재무/예산 섹션
  if (FINANCE_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "core";
  }

  // 재무 수치가 필요한 간접 섹션 (매출 목표, 성장 전략 등)
  if (FINANCE_ENHANCED_KEYWORDS.some((kw) => lower.includes(kw))) {
    return "enhanced";
  }

  return null;
}

// ---------------------------------------------------------------------------
// CFO 컨텍스트 빌더 — 섹션 유형에 따라 재무 전문가 지침 생성
// ---------------------------------------------------------------------------

export interface FinanceContext {
  sectionName: string;
  companyRevenue?: string;        // 기존 매출 정보
  companyIndustry?: string;       // 업종
  fundingAmount?: number;         // 신청 지원금액 (백만원)
  previousFinancialData?: string; // 앞 섹션에서 언급된 재무 수치
}

/**
 * 재무 핵심 섹션용 CFO 전문가 컨텍스트 생성
 */
export function buildCFOCoreContext(ctx: FinanceContext): string {
  const lines: string[] = [
    "\n# 🏦 CFO 사업부 재무 전문가 지침 (06-Finance Team)",
    "",
    "## 이 섹션은 CFO 사업부 재무 전문가가 검토합니다.",
    "아래 재무 전문가 기준을 반드시 충족하세요.",
    "",
  ];

  const lower = ctx.sectionName.toLowerCase();

  // 예산/사업비 섹션
  if (lower.includes("예산") || lower.includes("사업비") || lower.includes("집행") || lower.includes("소요")) {
    lines.push(`## 📊 사업비 작성 기준 (관리회계사 + 내부감사 관점)

### 필수 테이블 구조
\`\`\`
| 비목 | 세부항목 | 단가(원) | 수량 | 기간(월) | 합계(원) | 정부지원 | 자부담 | 산출근거 |
\`\`\`

### 비목별 작성 지침
1. **인건비**: 직급별 월급여 기준 × 인원 × 기간 (4대보험 포함 여부 명시)
2. **재료비**: 품명 × 단가 × 수량 (견적서 기반 단가, 시세 참고)
3. **외주용역비**: 용역 내용 × 단가 × 건수 (유사 실적 기반)
4. **기자재구입비**: 장비명 × 단가 × 수량 (카탈로그/견적 기반)
5. **여비**: 목적 × 일당 × 일수 × 인원 (출장 규정 준수)
6. **특허/인증비**: 출원료 + 심사료 + 등록료 (특허청 기준)
7. **기술정보비**: 학술지/DB 구독 × 기간

### 집행 계획표
| 분기 | 인건비 | 재료비 | 외주비 | 기자재 | 여비 | 기타 | 소계 |
각 분기별 집행 금액을 배분하고, 합계가 총 사업비와 일치하는지 검증

### 자부담 재원 조달
- 현금: 보유 현금/예금 잔액 명시
- 현물: 기존 장비/시설 활용 (감가상각 기준 평가)
- 기타: 대출, 투자유치 등`);
  }

  // 매출/수익 관련 섹션
  if (lower.includes("매출") || lower.includes("수익") || lower.includes("손익") || lower.includes("재무")) {
    lines.push(`## 📈 매출 추정 기준 (FP&A 전문가 관점)

### Bottom-up 매출 추정 모델
\`\`\`
연간 매출 = (제품A 단가 × 월 판매량 × 12) + (서비스B 월정액 × 고객수 × 12)
\`\`\`

### 3개 시나리오 테이블
| 시나리오 | 1차년도 | 2차년도 | 3차년도 | 4차년도 | 5차년도 | 전제조건 |
|---------|---------|---------|---------|---------|---------|---------|
| 보수적 | | | | | | 기존 고객만 + 자연 성장 |
| 기본 | | | | | | 영업 확대 + 신규 채널 |
| 낙관적 | | | | | | 해외 진출 + 대기업 수주 |

### 추정 손익계산서 (3~5년)
| 항목 | 1차년도 | 2차년도 | 3차년도 | 비고 |
|------|---------|---------|---------|------|
| 매출액 | | | | |
| 매출원가 | | | | 원가율 ○○% |
| 매출총이익 | | | | |
| 판관비 | | | | |
| 영업이익 | | | | |
| 영업이익률 | | | | |

### BEP 분석
- 고정비 = 인건비 + 임차료 + 감가상각비 = ○○원/월
- 변동비율 = 매출원가율 ○○%
- BEP 매출 = 고정비 ÷ (1 - 변동비율) = ○○원/월
- BEP 달성 예상 시점: 20XX년 Q○`);
  }

  // 기대효과 섹션 (경제적 효과 강화)
  if (lower.includes("기대") || lower.includes("효과")) {
    lines.push(`## 💰 경제적 기대효과 작성 기준 (IR재무담당 관점)

### 정량적 경제 효과 테이블
| 구분 | 지표 | 현재 | 사업 후 | 개선율 | 산출근거 |
|------|------|------|---------|--------|---------|
| 매출 | 연매출 | ○억원 | ○억원 | ○% | |
| 수출 | 수출액 | ○만$ | ○만$ | ○% | |
| 고용 | 인원 | ○명 | ○명 | +○명 | |
| 원가 | 제조원가 | ○% | ○% | -○%p | |

### 투자수익률 (ROI)
- 정부지원금: ○백만원
- 기대 매출 증가: ○억원 (3년 누적)
- ROI = (매출증가분 - 투자금) / 투자금 × 100 = ○○%
- 고용유발계수: 투자 1억원당 ○명 고용창출

### 세제 혜택 (세무전문가 관점)
- R&D 세액공제: 연구개발비의 25% (중소기업 기준)
- 창업 중소기업 세금감면: 소득세/법인세 5년간 50~100% 감면
- 고용증대 세액공제: 1인당 연 700~1,100만원`);
  }

  // 투자/자금조달 관련
  if (lower.includes("투자") || lower.includes("자금") || lower.includes("funding")) {
    lines.push(`## 🏗️ 자금조달 계획 (자금관리자 관점)

### 자금조달 구조표
| 구분 | 금액(백만원) | 비율(%) | 조달방법 | 시기 |
|------|------------|---------|---------|------|
| 정부지원금 | | | 선정 시 교부 | 20XX.Q○ |
| 자기자본 | | | 보유 현금 | 즉시 |
| 투자유치 | | | 시리즈 A | 20XX.Q○ |
| 기타(대출) | | | 기보/신보 | 20XX.Q○ |

### 현금흐름 관리 계획
- 월별 현금유입/유출 예측표 (12개월)
- 최소 현금보유액 기준: 3개월 운영비
- 긴급 자금 조달 방안: 마이너스 통장, 팩토링 등`);
  }

  // 사업화/전략 섹션 (재무 수치 강화)
  if (lower.includes("사업화") || lower.includes("전략") || lower.includes("성장") || lower.includes("scale")) {
    lines.push(`## 📊 사업화 전략 재무 지침 (CFO 관점)

### 연도별 매출 목표 테이블 (필수)
| 연도 | 매출(억원) | 영업이익(억원) | 영업이익률 | 수출(만$) | 고용(명) | 핵심전략 |
|------|-----------|-------------|-----------|----------|---------|---------|

### 수익 모델별 매출 분해
| 수익원 | 단가 | 예상 거래량/구독자 | 월매출 | 연매출 | 비중 |
|--------|------|------------------|--------|--------|------|

### 투자유치 로드맵
| 라운드 | 시기 | 금액(억원) | 밸류(억원) | 용도 | 주요 성과 기준 |

### 핵심 재무 KPI
- 고객획득비용(CAC): ○○만원/건
- 고객생애가치(LTV): ○○만원
- LTV/CAC 비율: ○배 (3배 이상 권장)
- 월간 소진률(Burn Rate): ○○만원/월
- 런웨이: ○○개월`);
  }

  // 공통: 수치 교차 검증 안내
  if (ctx.previousFinancialData) {
    lines.push(`\n## ⚠️ 수치 일관성 검증 (내부감사 관점)
앞 섹션에서 이미 언급된 재무 수치:
${ctx.previousFinancialData}

위 수치와 이 섹션의 재무 수치가 반드시 일치해야 합니다.
불일치 시 평가위원 신뢰도가 크게 하락합니다.`);
  }

  return lines.join("\n");
}

/**
 * 재무 간접 관련 섹션용 경량 컨텍스트 생성
 * (기대효과, 성장전략 등에서 재무 수치의 신뢰성 강화)
 */
export function buildCFOEnhancedContext(ctx: FinanceContext): string {
  return `
# 💼 CFO 재무 검토 지침 (06-Finance Team)

이 섹션에서 재무 관련 수치를 언급할 때 다음 기준을 준수하세요:

## 수치 신뢰성 강화
1. **모든 금액에 산출 근거**: "연매출 30억원 (월 2.5억 × 12개월, 고객 50개사 × 평균 500만원/월)"
2. **성장률 근거**: "전년 대비 275% 성장 (23년 8억 → 24년 30억, 주요 요인: 신규 거래처 20개 확보)"
3. **비교 수치**: 업계 평균 대비 자사 위치 (업계 평균 영업이익률 5% → 자사 12%)
4. **출처 등급**: 정부통계(A+) > 연구기관(A) > 기업공시(B), 블로그 인용 불가(D)

## 재무 표현 기준
- 천만원 이하: 만원 단위 (예: 1,500만원)
- 1억 이상: 억원 단위 (예: 3.5억원)
- 성장률: % 표기 + 절대값 병기 (예: 275% 성장, 8억→30억)
- 시장규모: 원화 + 달러 병기 권장

## 재무 수치 간 일관성
${ctx.previousFinancialData ? `앞 섹션 재무 수치 참조:\n${ctx.previousFinancialData}` : "앞 섹션에서 언급한 매출/성장률/인원 등의 수치와 반드시 일치시키세요."}`;
}

// ---------------------------------------------------------------------------
// extractFinancialData — 작성된 섹션에서 재무 수치를 추출 (후속 섹션 일관성용)
// ---------------------------------------------------------------------------

/**
 * 작성된 섹션 내용에서 재무 관련 수치를 추출하여 요약
 * 후속 섹션에서 수치 일관성을 유지하기 위해 사용
 */
export function extractFinancialDataFromContent(content: string): string {
  const findings: string[] = [];

  // 매출 수치 추출
  const revenuePatterns = content.match(
    /매출[^\n]*?(\d[\d,.]+\s*(?:억|만|천|백)?(?:원|달러|\$|USD))/g,
  );
  if (revenuePatterns) {
    findings.push(`매출: ${revenuePatterns.slice(0, 3).join(", ")}`);
  }

  // 성장률 추출
  const growthPatterns = content.match(
    /(?:성장률?|증가율?|CAGR)[^\n]*?(\d+\.?\d*\s*%)/g,
  );
  if (growthPatterns) {
    findings.push(`성장률: ${growthPatterns.slice(0, 2).join(", ")}`);
  }

  // 인원수 추출
  const headcountPatterns = content.match(
    /(?:인원|인력|직원|임직원)[^\n]*?(\d+\s*명)/g,
  );
  if (headcountPatterns) {
    findings.push(`인원: ${headcountPatterns.slice(0, 2).join(", ")}`);
  }

  // 투자금 추출
  const investPatterns = content.match(
    /(?:투자|유치|펀딩)[^\n]*?(\d[\d,.]+\s*(?:억|만)?원)/g,
  );
  if (investPatterns) {
    findings.push(`투자: ${investPatterns.slice(0, 2).join(", ")}`);
  }

  // BEP 추출
  const bepPatterns = content.match(
    /(?:BEP|손익분기|손익 분기)[^\n]*?(\d{4}[년.]\s*(?:Q[1-4]|\d+월?))/g,
  );
  if (bepPatterns) {
    findings.push(`BEP: ${bepPatterns[0]}`);
  }

  // 시장규모 추출
  const marketPatterns = content.match(
    /(?:TAM|SAM|SOM|시장\s*규모)[^\n]*?(\d[\d,.]+\s*(?:억|조|만)?(?:원|달러|\$))/g,
  );
  if (marketPatterns) {
    findings.push(`시장: ${marketPatterns.slice(0, 3).join(", ")}`);
  }

  if (findings.length === 0) return "";
  return findings.join("\n");
}

// ---------------------------------------------------------------------------
// 재무 섹션 품질 강화 — 기존 scorer에 추가할 재무 전용 검증
// ---------------------------------------------------------------------------

export interface FinanceQualityCheck {
  hasCalculationBasis: boolean;    // 산출근거 테이블 존재
  hasRevenueProjection: boolean;   // 매출 추정 존재
  has3Scenarios: boolean;          // 3개 시나리오 존재
  hasBEP: boolean;                 // BEP 분석 존재
  hasCashFlow: boolean;            // 현금흐름 분석 존재
  hasQuarterlyPlan: boolean;       // 분기별 계획 존재
  hasUnitEconomics: boolean;       // 유닛 이코노믹스 (CAC/LTV)
  financialScore: number;          // 재무 품질 점수 (0~100)
  suggestions: string[];
}

/**
 * 재무 섹션 전용 품질 검증
 */
export function checkFinanceQuality(
  content: string,
  sectionName: string,
): FinanceQualityCheck {
  const lower = content.toLowerCase();

  // 산출근거 테이블 존재
  const hasCalculationBasis =
    /\|.*단가.*\|.*수량.*\|/i.test(content) ||
    /\|.*산출근거.*\|/i.test(content) ||
    (/단가/.test(content) && /수량/.test(content) && /합계/.test(content));

  // 매출 추정 (Bottom-up 또는 Top-down)
  const hasRevenueProjection =
    /(?:매출\s*(?:추정|예측|목표)|연매출|월매출|매출액)/i.test(content) &&
    /\d/.test(content);

  // 3시나리오
  const has3Scenarios =
    (/보수적/.test(content) && /낙관적/.test(content)) ||
    (/scenario/i.test(content) && /conservative/i.test(content));

  // BEP
  const hasBEP =
    /(?:BEP|손익\s*분기|break[\s-]*even)/i.test(content);

  // 현금흐름
  const hasCashFlow =
    /(?:현금\s*흐름|cash\s*flow|현금\s*유입|현금\s*유출)/i.test(content);

  // 분기별 계획
  const hasQuarterlyPlan =
    /(?:Q[1-4]|[1-4]분기|분기별)/i.test(content) &&
    /\|/.test(content);

  // 유닛 이코노믹스
  const hasUnitEconomics =
    /(?:CAC|LTV|ARPU|고객\s*획득\s*비용|고객\s*생애\s*가치|MRR|ARR)/i.test(content);

  // 점수 계산
  let score = 0;
  const suggestions: string[] = [];

  const isCoreBudget = /예산|사업비|집행|소요|자금/i.test(sectionName);
  const isCoreRevenue = /매출|수익|손익|재무/i.test(sectionName);

  if (hasCalculationBasis) score += 25;
  else if (isCoreBudget) suggestions.push("항목별 산출근거 테이블(단가×수량×기간=금액)을 추가하세요 — CFO 필수 기준");

  if (hasRevenueProjection) score += 20;
  else if (isCoreRevenue) suggestions.push("Bottom-up 매출 추정(단가×판매량) 또는 연도별 매출 목표를 추가하세요");

  if (has3Scenarios) score += 15;
  else if (isCoreRevenue) suggestions.push("보수적/기본/낙관적 3개 시나리오 매출 추정을 제시하세요");

  if (hasBEP) score += 10;
  else if (isCoreRevenue || isCoreBudget) suggestions.push("BEP(손익분기점) 분석을 추가하세요 — 고정비÷(1-변동비율)");

  if (hasCashFlow) score += 10;
  else suggestions.push("현금흐름 분석(월별/분기별 유입/유출)을 추가하면 점수가 향상됩니다");

  if (hasQuarterlyPlan) score += 10;
  else if (isCoreBudget) suggestions.push("분기별 사업비 집행 계획표를 추가하세요");

  if (hasUnitEconomics) score += 10;
  else suggestions.push("CAC(고객획득비용)/LTV(고객생애가치) 등 유닛 이코노믹스를 추가하면 투자자 관점에서 설득력이 높아집니다");

  return {
    hasCalculationBasis,
    hasRevenueProjection,
    has3Scenarios,
    hasBEP,
    hasCashFlow,
    hasQuarterlyPlan,
    hasUnitEconomics,
    financialScore: score,
    suggestions,
  };
}
