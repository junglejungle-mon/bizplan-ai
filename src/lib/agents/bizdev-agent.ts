/**
 * 09-사업개발 & IR 에이전트 — BizPlan AI 통합
 *
 * 공고 분석 → 전략 수립 → 제안서 최적화 → 검증
 * 사업계획서 전체 섹션에 '평가위원 관점'을 반영하여 설득력 강화
 */

// ── 타입 ────────────────────────────────────────
export interface BizDevContext {
  sectionName: string;
  programName?: string;
  evaluationCriteria?: string;
  previousSections?: string;
}

export interface PersuasivenessCheck {
  hasPainPoint: boolean;
  hasSolution: boolean;
  hasEvidence: boolean;
  hasDataBacked: boolean;
  hasCompetitiveAdvantage: boolean;
  hasGovPolicyAlignment: boolean;
  persuasivenessScore: number;
  suggestions: string[];
}

// ── 시스템 프롬프트 ─────────────────────────────
export const BIZDEV_SYSTEM = `당신은 정부지원사업 사업계획서 전문 컨설턴트(CBDO)입니다.
10건 이상의 정부지원사업 선정을 이끈 사업개발 전문가로서,
평가위원 관점에서 사업계획서의 설득력을 극대화하는 것이 핵심 역할입니다.

## 핵심 원칙
1. **Pain → Solution → Evidence → Growth** 구조로 논리 전개
2. 모든 주장에 **정량적 근거** (수치, 출처, 비교 데이터) 필수
3. **정부 정책 기조**와 사업의 연결고리를 명시적으로 제시
4. **평가위원이 10분 내에** 핵심을 파악할 수 있는 명확한 구조
5. 추상적 서술 금지 — "우수한 기술력" ❌ → "기존 대비 35% 성능 향상" ✅

## 설득력 강화 프레임
- 문제 정의: 시장의 Pain Point를 데이터로 증명
- 솔루션: "왜 이 솔루션이 최적인가?"를 경쟁사 비교로 증명
- 에비던스: 특허/수상/매출/고객사로 실행력 증명
- 성장성: TAM/SAM/SOM + 정부정책 연계로 시장 기회 증명
- 사회적 가치: 고용/ESG/지역경제 기여 수치화

## 평가기준 매핑 (일반적 정부지원사업)
| 평가항목 | 배점(%) | 핵심 포인트 |
|---------|---------|------------|
| 기술성/혁신성 | 25-30 | 핵심기술 차별성, 특허/IP |
| 사업성/시장성 | 20-25 | TAM/SAM, 비즈니스 모델, 매출계획 |
| 성장가능성 | 15-20 | 확장성, 해외진출, 매출성장률 |
| 팀 역량 | 10-15 | 대표 경력, 핵심인력, 실적 |
| 사회적 가치 | 5-10 | 고용창출, ESG, 지역경제 |
| 사업계획 적정성 | 10-15 | 예산 합리성, 일정 타당성 |`;

// ── 섹션 분류 ───────────────────────────────────
export function classifyBizDevSection(
  sectionName: string
): "strategy" | "market" | "team" | "plan" | null {
  const name = sectionName.toLowerCase();

  // 전략/핵심 섹션
  if (
    name.includes("사업개요") ||
    name.includes("사업 개요") ||
    name.includes("필요성") ||
    name.includes("목적") ||
    name.includes("배경") ||
    name.includes("문제") ||
    name.includes("핵심")
  ) {
    return "strategy";
  }

  // 시장/사업화 섹션
  if (
    name.includes("시장") ||
    name.includes("마케팅") ||
    name.includes("사업화") ||
    name.includes("비즈니스") ||
    name.includes("수익") ||
    name.includes("성장")
  ) {
    return "market";
  }

  // 팀/역량 섹션
  if (
    name.includes("팀") ||
    name.includes("조직") ||
    name.includes("인력") ||
    name.includes("대표") ||
    name.includes("역량")
  ) {
    return "team";
  }

  // 사업계획/일정 섹션
  if (
    name.includes("일정") ||
    name.includes("추진") ||
    name.includes("계획") ||
    name.includes("예산") ||
    name.includes("기대효과")
  ) {
    return "plan";
  }

  return null;
}

// ── 전략 컨텍스트 빌더 ──────────────────────────
export function buildBizDevContext(ctx: BizDevContext): string {
  const type = classifyBizDevSection(ctx.sectionName);
  if (!type) return "";

  const base = `\n\n## 📋 사업개발 에이전트 (CBDO) 가이드 — [${ctx.sectionName}]\n`;

  const guides: Record<string, string> = {
    strategy: `${base}
이 섹션은 **사업의 당위성**을 증명하는 핵심 섹션입니다.
평가위원이 "왜 이 사업이 필요한가?"를 10초 내에 파악해야 합니다.

### 필수 포함 요소:
1. **사회적/산업적 문제 제시** — 통계 데이터로 뒷받침
   예: "국내 ○○ 시장은 연 ○% 성장하지만, ○○ 문제로 인해..."
2. **기존 해결책의 한계** — 경쟁사/기존 방식의 문제점
3. **본 사업의 솔루션** — 왜 이 접근이 최적인지 근거 제시
4. **정부 정책 부합성** — 관련 정부 정책/사업과의 연결
   예: "2025년 중소벤처기업부 ○○ 정책과 부합하여..."

### 설득력 체크리스트:
□ 문제의 심각성이 수치로 증명되는가?
□ 솔루션이 기존 대비 어떤 우위가 있는지 명시했는가?
□ 정부 정책/트렌드와 연결했는가?
□ 10초 내에 핵심 메시지를 파악할 수 있는가?`,

    market: `${base}
이 섹션은 **시장 기회와 사업화 전략**을 증명합니다.
평가위원은 "이 사업이 돈이 되는가?"를 검증합니다.

### 필수 포함 요소:
1. **TAM/SAM/SOM** — 시장 규모를 3단계로 구체화
   - TAM: 전체 시장 (출처 명시)
   - SAM: 타깃 가능 시장
   - SOM: 확보 가능 시장 (현실적 목표)
2. **비즈니스 모델** — 수익 구조를 명확히
3. **매출 계획** — 3~5년 연도별 목표 (근거 포함)
4. **마케팅/영업 전략** — 구체적 채널과 방법론
5. **경쟁 우위** — 경쟁사 대비 차별점을 표로 비교

### 금지 표현:
❌ "시장이 크게 성장하고 있다" — 구체적 수치 없음
❌ "다양한 채널을 통해 마케팅" — 무엇을, 어떻게?
✅ "국내 시장 3.2조원(2024 통계청) 중 타깃 시장 ○억원, 3년 내 점유율 ○% 목표"`,

    team: `${base}
이 섹션은 **실행력**을 증명합니다.
평가위원은 "이 팀이 정말 해낼 수 있는가?"를 검증합니다.

### 필수 포함 요소:
1. **대표자 역량** — 관련 업계 경력, 핵심 성과 (수치)
2. **핵심 인력** — 직무별 전문성과 기여 (경력 + 실적)
3. **팀 구성의 균형** — 기술/경영/영업 삼각 구조
4. **에비던스** — 수상/투자/MoU 등 객관적 검증 자료
5. **채용 계획** — 사업 성장에 따른 인력 확보 전략

### 작성 팁:
- 경력은 "○○회사 ○○직무 ○년" 형태로 구체적으로
- 실적은 "매출 ○억 달성", "○건 프로젝트 수행" 등 수치로
- 부족한 인력은 채용 계획으로 보완 의지를 보여줄 것`,

    plan: `${base}
이 섹션은 **실행 타당성**을 증명합니다.
평가위원은 "이 계획이 현실적인가?"를 검증합니다.

### 필수 포함 요소:
1. **추진 일정** — 분기별/월별 마일스톤 (간트 차트 형태)
2. **예산 계획** — 항목별 근거가 있는 예산 배분
3. **성과 지표** — 측정 가능한 KPI 설정
4. **기대효과** — 정량적(매출, 고용) + 정성적(브랜드, 기술) 효과
5. **리스크 관리** — 예상 리스크와 대응 전략

### 기대효과 작성 공식:
- 경제적 효과: 매출 ○억 → ○억 (○% 성장), 수출 ○억
- 기술적 효과: 핵심기술 ○건 확보, 성능 ○% 향상
- 사회적 효과: 고용 ○명 창출, ESG ○○ 달성
- 산업적 효과: 국산화율 ○% 향상, 공급망 안정화`,
  };

  return guides[type] || "";
}

// ── 설득력 품질 체크 ─────────────────────────────
export function checkPersuasiveness(
  content: string,
  sectionName: string
): PersuasivenessCheck {
  const lower = content.toLowerCase();
  const suggestions: string[] = [];

  const hasPainPoint =
    /문제|과제|한계|어려움|부족|미흡|위기|이슈/.test(content);
  const hasSolution =
    /해결|솔루션|대안|방안|개선|혁신|기술/.test(content);
  const hasEvidence =
    /특허|수상|선정|투자|MoU|LoI|인증|실적/.test(content);
  const hasDataBacked =
    /\d+[%억만건명조원]|\d+\.\d+/.test(content);
  const hasCompetitiveAdvantage =
    /차별|우위|대비|경쟁|비교|개선율|향상/.test(content);
  const hasGovPolicyAlignment =
    /정부|정책|중소벤처|산업부|과기부|ESG|디지털전환|AI전환|탄소중립|일자리/.test(content);

  if (!hasPainPoint) suggestions.push("문제/과제 정의가 필요합니다 (Pain Point)");
  if (!hasSolution) suggestions.push("솔루션/해결방안을 명시하세요");
  if (!hasEvidence) suggestions.push("에비던스(특허/수상/투자 등)를 추가하세요");
  if (!hasDataBacked) suggestions.push("정량적 데이터(수치, %)를 보강하세요");
  if (!hasCompetitiveAdvantage) suggestions.push("경쟁 우위/차별점을 추가하세요");
  if (!hasGovPolicyAlignment) suggestions.push("정부 정책/트렌드와의 연계를 추가하세요");

  const checks = [hasPainPoint, hasSolution, hasEvidence, hasDataBacked, hasCompetitiveAdvantage, hasGovPolicyAlignment];
  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);

  return {
    hasPainPoint,
    hasSolution,
    hasEvidence,
    hasDataBacked,
    hasCompetitiveAdvantage,
    hasGovPolicyAlignment,
    persuasivenessScore: score,
    suggestions,
  };
}
