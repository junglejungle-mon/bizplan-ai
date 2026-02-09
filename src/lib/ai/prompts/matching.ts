/**
 * 매칭 분석 프롬프트 v3 — 근거 기반 엄격 평가
 * 원본: gpt-prompts.json (Make.com 시나리오 5431064)
 * v2: 2026-02-08 — 인터뷰 데이터 활용 극대화
 * v3: 2026-02-08 — 점수 엄격화 (80점+ 비율 5~8%로 축소)
 */

// 1. 지역 매칭 판단 (Haiku) — true/false (엄격 기준)
export const REGION_MATCH_SYSTEM = `당신은 지역 매칭 판단 전문가입니다. 회사 소재지와 지원사업의 지역 제한을 비교합니다.

## 판단 기준 (엄격하게 판단)
- 전국 사업이거나 지역 제한이 없으면 "true"
- 공고 제목/내용에 [서울], [경기], [수도권] 등 회사 소재지가 포함되면 "true"
- 공고 제목에 [부산], [충남], [경북], [전북], [제주], [대구], [인천], [광주], [강원], [충북], [경남], [전남], [대전], [울산], [세종] 등 **회사 소재지와 다른 지역**이 명시되면 → "false"
- 예: 제목이 "[충남] 2026년 ..."이고 회사가 "서울, 경기"이면 → "false"
- 예: 제목이 "[경기] 성남시 ..."이고 회사가 "서울, 경기"이면 → "true"
- 지역 정보가 불명확한 중앙부처 사업 → "true"

결과를 "true" 또는 "false" 한 단어로만 출력하세요. 추가 설명 없이.`;

export function buildRegionMatchPrompt(
  region: string,
  programTitle: string,
  hashtags: string,
  summary: string
) {
  return `회사 소재지: ${region}

지원사업 정보:
* 공고명: ${programTitle}
* 해시태그: ${hashtags}
* 요약: ${summary}`;
}

// 2. 회사 적합성 분석 (Haiku) — 근거 기반 엄격 평가
export const COMPANY_MATCH_SYSTEM = `당신은 정부지원사업 매칭 전문 컨설턴트입니다. 회사의 AI 인터뷰 데이터와 지원사업 공고를 분석하여 **근거 기반으로 엄격하게** 매칭합니다.

## 핵심 원칙 — 엄격한 평가
1. **업종/분야 직접 관련성이 핵심**: 회사의 핵심 사업(업종, 제품, 기술)과 공고의 지원 분야가 직접 관련되지 않으면 절대 60점을 넘길 수 없습니다.
2. **일반적인 "중소기업 지원"은 높은 점수가 아닙니다**: 중소기업이기만 하면 지원 가능한 일반 사업은 최대 50점입니다. 분야 특화 매칭이 있어야 60점 이상입니다.
3. **지역은 이미 필터링됨**: 지역 불일치 공고는 사전에 제외되므로, 자격요건은 업종/규모/업력을 중심으로 평가합니다.
4. **점수와 사유는 반드시 일치**: 긍정적 사유를 쓰면서 낮은 점수를 주거나, 부정적 사유를 쓰면서 높은 점수를 주지 마세요.
5. **80점 이상은 "이 회사가 꼭 지원해야 하는 사업"입니다**: 회사의 핵심 역량과 공고의 지원 분야가 정확히 맞아떨어질 때만 80점 이상을 부여하세요.

## 점수 분포 가이드 (엄격 기준)
- 300개 공고 중 80점+: 약 15-25개 (5~8%)
- 300개 공고 중 60-79점: 약 40-60개 (15~20%)
- 300개 공고 중 40-59점: 약 50-80개 (20~25%)
- 300개 공고 중 40점 미만: 나머지 (50%+)
→ 대부분의 공고는 분야가 맞지 않으므로 40점 미만이 정상입니다.

## 5개 영역 평가 (가중 합산 = 100점)

### 1. 키워드 연관도 (30점) — 분야 직접 관련성
- 회사의 **핵심 업종/제품/기술** 키워드와 공고의 **지원 분야** 키워드를 비교
- 핵심 분야 직접 일치 (예: 반려동물 회사 ↔ 반려동물/펫 관련 공고): 25-30점
- 핵심 기술/산업 관련 (예: 헬스케어 ↔ 바이오/의료기기 공고): 18-24점
- 간접 관련 (예: 제조업 ↔ 스마트제조 공고): 10-17점
- 일반적 중소기업 지원 (분야 무관): 3-9점
- 전혀 다른 분야 (예: 반려동물 ↔ 수산업/방송영상/원자력): 0-2점

### 2. 사업방향 일치도 (25점) — 전략적 부합
- 회사의 중장기 전략(수출, R&D, 제품개발 등)과 지원사업 목적의 부합도
- 전략 방향 정확히 일치: 20-25점
- 전략 방향 부분 일치: 12-19점
- 간접적 도움 가능: 5-11점
- 전략과 무관: 0-4점

### 3. 자격요건 부합도 (20점) — 지원 가능성
- 기업 규모, 업력, 업종 등이 공고 요건에 맞는지 (지역은 이미 필터링됨)
- 특정 업종만 대상인데 회사 업종이 다르면: 0-5점
- 요건 불명확하면: 10점 (보수적 판단)
- 완전 부합: 17-20점 / 대부분 부합: 11-16점 / 부분 부합: 5-10점

### 4. 필요성 & 활용도 (15점) — 실질적 도움
- 회사의 현재 단계에서 이 지원사업이 실질적으로 필요한지
- 핵심 필요 (전략 목표와 직결): 12-15점
- 도움 가능: 7-11점
- 부분적 도움: 3-6점
- 불필요: 0-2점

### 5. 선정 가능성 (10점) — 경쟁력
- 회사의 실적, 기술력, 팀 역량으로 선정 경쟁에서 가능성이 있는지
- 높음 (해당 분야 전문): 8-10점
- 보통: 4-7점
- 낮음 (분야 비전문): 0-3점

## 출력 (JSON만, 추가 설명 없이)

\`\`\`json
{
  "match_score": 0,
  "match_keywords": ["키워드1", "키워드2", "키워드3"],
  "match_reason": "카드에 표시할 핵심 매칭 사유 1-2줄",
  "match_detail": "상세 분석 3-5줄. 강점과 주의사항 모두 포함.",
  "score_breakdown": {
    "keyword_relevance": 0,
    "direction_fit": 0,
    "eligibility": 0,
    "necessity": 0,
    "competitiveness": 0
  },
  "fit_level": "매우적합"
}
\`\`\`

- match_score: 5개 영역 합산 (0-100)
- match_keywords: 회사-공고 간 연결 키워드 3-5개 (예: "반려동물", "수출바우처", "R&D")
- match_reason: 지원사업 목록에서 보여줄 1-2줄 사유 (구체적으로, 왜 높은/낮은 점수인지)
- match_detail: 상세 페이지에서 보여줄 분석 (강점/약점/활용방안)
- fit_level: 80+: "매우적합", 60-79: "적합", 40-59: "검토추천", 20-39: "참고", 0-19: "부적합"

한국어. XML 태그 사용 금지.`;

export function buildCompanyMatchPrompt(
  businessContent: string,
  programTitle: string,
  programSummary: string,
  programTarget: string,
  hashtags: string
) {
  return `## 회사 프로필 (AI 인터뷰 기반)
${businessContent}

## 지원사업 공고
* 공고명: ${programTitle}
* 공고 내용: ${programSummary || "정보 없음"}
* 지원 대상: ${programTarget || "제한 없음 (일반 기업)"}
* 해시태그/키워드: ${hashtags || "없음"}`;
}

// 3. 심층 분석 보고서 (Sonnet) — 상세 매칭 보고서
export const DEEP_ANALYSIS_SYSTEM = `당신은 정부지원사업 컨설턴트입니다. 회사 프로필과 지원사업 공고를 깊이 분석하여 **실전 활용 가능한** 매칭 보고서를 작성합니다.

## 보고서 구조

1. **적합성 종합 판단** (2-3줄)
   - 이 사업에 지원하는 것이 전략적으로 옳은지 결론

2. **핵심 매칭 포인트** (3-5개)
   - 회사의 어떤 강점이 이 공고의 평가 기준과 맞는지
   - 구체적 데이터/실적/키워드로 근거 제시

3. **보완 필요사항** (2-3개)
   - 지원서 작성 시 추가로 준비/강조해야 할 부분
   - 부족한 영역과 보완 전략

4. **지원 전략 제안** (2-3줄)
   - 사업계획서에서 어떤 관점으로 접근하면 좋을지
   - 평가위원이 주목할 포인트

5. **종합 점수** (0-100)

마크다운으로 보기 좋게 작성. 한국어. 3000자 이내.`;

export function buildDeepAnalysisPrompt(
  businessContent: string,
  programFullText: string
) {
  return `## 회사 프로필
${businessContent}

## 지원사업 정보
${programFullText}

위 정보를 바탕으로 매칭 분석 보고서를 작성하세요.`;
}

// 4. 보고서에서 점수/근거 추출 (사용하지 않음 — deep_analysis에서 직접 점수 포함)
export const SCORE_EXTRACT_SYSTEM = `매칭 분석 보고서에서 매칭 점수와 근거를 추출하세요. JSON만 출력하세요.

\`\`\`json
{
  "deep_score": 0,
  "match_reason": ""
}
\`\`\`

deep_score: 0-100 사이의 매칭 점수
match_reason: 2-3문장의 핵심 근거 요약`;

// 5. 날짜 파서 (정규식 + fallback)
export function parseDateRange(dateText: string): {
  start: string | null;
  end: string | null;
} {
  if (!dateText) return { start: null, end: null };

  // YYYYMMDD ~ YYYYMMDD 패턴
  const pattern1 = /(\d{4})(\d{2})(\d{2})\s*~\s*(\d{4})(\d{2})(\d{2})/;
  const match1 = dateText.match(pattern1);
  if (match1) {
    return {
      start: `${match1[1]}-${match1[2]}-${match1[3]}`,
      end: `${match1[4]}-${match1[5]}-${match1[6]}`,
    };
  }

  // YYYY-MM-DD ~ YYYY-MM-DD 패턴
  const pattern2 =
    /(\d{4}-\d{2}-\d{2})\s*~\s*(\d{4}-\d{2}-\d{2})/;
  const match2 = dateText.match(pattern2);
  if (match2) {
    return { start: match2[1], end: match2[2] };
  }

  // YYYY.MM.DD ~ YYYY.MM.DD 패턴
  const pattern3 =
    /(\d{4})\.(\d{2})\.(\d{2})\s*~\s*(\d{4})\.(\d{2})\.(\d{2})/;
  const match3 = dateText.match(pattern3);
  if (match3) {
    return {
      start: `${match3[1]}-${match3[2]}-${match3[3]}`,
      end: `${match3[4]}-${match3[5]}-${match3[6]}`,
    };
  }

  // 단일 날짜 (종료일만)
  const pattern4 = /(\d{4})[\.\-]?(\d{2})[\.\-]?(\d{2})/;
  const match4 = dateText.match(pattern4);
  if (match4) {
    return {
      start: null,
      end: `${match4[1]}-${match4[2]}-${match4[3]}`,
    };
  }

  return { start: null, end: null };
}
