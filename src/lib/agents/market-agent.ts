/**
 * 02-마케팅 + 13-데이터/BI + 16-글로벌확장 에이전트 — BizPlan AI 통합
 *
 * 사업계획서의 시장분석/마케팅/해외진출 섹션을 전문적으로 강화
 * CMO(마케팅) + CDO(데이터) + CGO(글로벌) 3팀 통합
 */

// ── 타입 ────────────────────────────────────────
export interface MarketContext {
  sectionName: string;
  companyIndustry?: string;
  companyRegion?: string;
  hasExportPlan?: boolean;
}

// ── 시스템 프롬프트 ─────────────────────────────
export const MARKET_INTELLIGENCE_SYSTEM = `당신은 시장분석/마케팅 전략/데이터 분석 통합 전문가입니다.
CMO(마케팅), CDO(데이터), CGO(글로벌) 3개 사업부의 역량을 결합하여
사업계획서의 시장 관련 섹션을 전문적으로 작성합니다.

## 시장분석 작성 원칙
1. **데이터 기반**: 모든 시장 수치에 출처 명시 (통계청, KIET, 업계 보고서 등)
2. **TAM/SAM/SOM 구조**: 시장 규모를 3단계로 구체화
3. **트렌드 연결**: 시장 트렌드를 사업과 연결 (정부 정책 포함)
4. **경쟁 분석**: 경쟁사 비교 표로 차별점 시각화
5. **글로벌 시각**: 해외 시장 기회와 진입 전략 포함

## 마케팅 전략 작성 원칙
1. **채널 구체화**: "다양한 채널" ❌ → "온라인(자사몰+쿠팡+스마트스토어) + 오프라인(대리점 20개) + B2B(납품 5개사)" ✅
2. **고객 여정(Funnel)**: 인지 → 관심 → 검토 → 구매 → 재구매 단계별 전략
3. **CAC/LTV**: 고객 획득 비용과 생애 가치 추정 (가능한 경우)
4. **퍼포먼스 지표**: ROI, CVR, CPC 등 측정 가능한 KPI 설정

## 글로벌 진출 작성 원칙
1. **타깃 국가 선정 근거**: 왜 이 국가인지 (시장 규모, 진입 장벽, 정부 지원)
2. **인허가/규제**: 해당 국가 인증 요건 (FDA, CE, KFDA 등)
3. **진입 전략**: 직접 수출, 에이전트, 현지 법인 등 구체적 방법
4. **수출 바우처 활용**: 정부 수출 지원 사업과 연계

## 출처 등급
- A+: 정부 통계 (통계청, KOSIS, e-나라지표)
- A: 공인 연구기관 (KIET, KEIT, KDB)
- B: 기업 공시자료 (DART, IR)
- C: 전문 매체 (업계 리포트)
- D: 블로그/SNS (인용 불가)`;

// ── 섹션 분류 ───────────────────────────────────
export function classifyMarketSection(
  sectionName: string
): "market_analysis" | "marketing_strategy" | "global" | null {
  const name = sectionName.toLowerCase();

  if (
    name.includes("시장") ||
    name.includes("산업") ||
    name.includes("경쟁") ||
    name.includes("동향") ||
    name.includes("트렌드")
  ) {
    return "market_analysis";
  }

  if (
    name.includes("마케팅") ||
    name.includes("영업") ||
    name.includes("판매") ||
    name.includes("고객") ||
    name.includes("채널") ||
    name.includes("사업화")
  ) {
    return "marketing_strategy";
  }

  if (
    name.includes("해외") ||
    name.includes("수출") ||
    name.includes("글로벌") ||
    name.includes("국제") ||
    name.includes("진출")
  ) {
    return "global";
  }

  return null;
}

// ── 시장 컨텍스트 빌더 ──────────────────────────
export function buildMarketContext(ctx: MarketContext): string {
  const type = classifyMarketSection(ctx.sectionName);
  if (!type) return "";

  const base = `\n\n## 📊 시장 인텔리전스 에이전트 (CMO+CDO+CGO) — [${ctx.sectionName}]\n`;

  const guides: Record<string, string> = {
    market_analysis: `${base}
### 시장분석 섹션 작성 가이드

**반드시 포함할 요소:**
1. **시장 규모** (TAM → SAM → SOM)
   - 글로벌 시장: ○조원 (출처, 연도)
   - 국내 시장: ○조원 (CAGR ○%)
   - 타깃 시장: ○억원 (산출 근거)
   - 확보 목표: ○억원 (현실적 점유율 ○%)

2. **시장 트렌드** (3~5개, 정부정책 연결 필수)
   예: "AI/디지털전환 (정부 예산 ○조원 편성)"
   예: "ESG 의무화 (2025년 상장사 ESG 공시 의무)"

3. **경쟁 환경** (표 형태 필수)
   | 구분 | 자사 | 경쟁A | 경쟁B |
   |------|------|-------|-------|
   | 핵심기술 | ... | ... | ... |
   | 가격 | ... | ... | ... |
   | 성능 | ... | ... | ... |

4. **타깃 고객** (페르소나 + 규모)
   - B2B: 업종, 규모, 예상 기업 수
   - B2C: 연령, 특성, 예상 사용자 수

${ctx.companyIndustry ? `\n업종(${ctx.companyIndustry}) 관련 최신 시장 데이터를 반드시 참조하세요.` : ""}`,

    marketing_strategy: `${base}
### 마케팅/사업화 전략 섹션 작성 가이드

**반드시 포함할 요소:**
1. **채널 전략** (구체적 채널명 + 투자 비중)
   - 온라인: 자사몰(○%), 쿠팡/네이버(○%), SNS(○%)
   - 오프라인: 대리점(○개), 전시회(○건/년)
   - B2B: 직접영업(○건/월), 파트너(○개사)

2. **고객 확보 전략**
   - 초기: ○○ 방법으로 첫 ○○명 확보
   - 성장: ○○ 전략으로 월 ○○명 신규 유입
   - 유지: 재구매율 ○% 목표, ○○ 로열티 프로그램

3. **매출 계획** (3~5년, 산출 근거 필수)
   | 연도 | 목표매출 | 근거 |
   |------|---------|------|
   | 1차년 | ○억 | 기존 고객 ○건 × 단가 ○만원 |
   | 2차년 | ○억 | 신규 채널 확대 + 해외 진출 |
   | 3차년 | ○억 | 시장 점유율 ○% 달성 |

4. **가격 전략** (근거 포함)
   - 경쟁사 대비 가격 포지셔닝
   - 원가 구조와 마진율`,

    global: `${base}
### 해외진출/글로벌 전략 섹션 작성 가이드

**반드시 포함할 요소:**
1. **타깃 시장 선정** (국가별 근거)
   - 1차: ○○ (시장 규모 ○조원, 진입장벽 낮음)
   - 2차: ○○ (성장률 ○%, 한류 효과)
   - 3차: ○○ (정부 수출 지원 집중 국가)

2. **인허가/규제 대응**
   - 해당 국가 필수 인증 (FDA, CE, ISO 등)
   - 현재 보유/취득 계획

3. **진출 전략** (단계별)
   - 1단계: 온라인 수출 (아마존, 알리바바)
   - 2단계: 현지 에이전트/대리점
   - 3단계: 현지 법인/생산 거점

4. **정부 지원 활용**
   - 수출바우처 (KOTRA)
   - 해외 전시회 지원
   - 물류/통관 지원

5. **수출 목표** (연도별, 국가별)
   | 연도 | 국가 | 목표매출 | 전략 |
   |------|------|---------|------|
   | 1차년 | ... | ○만불 | ... |

${ctx.hasExportPlan ? "이 기업은 해외진출 계획이 있으므로, 구체적 전략을 수립해 주세요." : "해외진출 가능성을 탐색하고, 적합한 수출 시장을 제안해 주세요."}`,
  };

  return guides[type] || "";
}

// ── 시장데이터 추출 ─────────────────────────────
export function extractMarketDataFromContent(content: string): string {
  const extracted: string[] = [];

  // 시장 규모
  const marketSize = content.match(/시장[^.]*?(\d+[\.,]?\d*)\s*(조|억|만)\s*원/g);
  if (marketSize) extracted.push(...marketSize.map((m) => m.trim()));

  // 성장률
  const cagr = content.match(/(?:성장률|CAGR|증가율)[^.]*?(\d+[\.,]?\d*)\s*%/g);
  if (cagr) extracted.push(...cagr.map((m) => m.trim()));

  // 수출 관련
  const exportData = content.match(/수출[^.]*?(\d+[\.,]?\d*)\s*(만불|억원|만원|달러)/g);
  if (exportData) extracted.push(...exportData.map((m) => m.trim()));

  // 점유율
  const share = content.match(/점유율[^.]*?(\d+[\.,]?\d*)\s*%/g);
  if (share) extracted.push(...share.map((m) => m.trim()));

  return extracted.length > 0 ? extracted.join("; ") : "";
}
