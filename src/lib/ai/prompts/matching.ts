/**
 * 매칭 분석 프롬프트 (기존 GPT → Claude 이식)
 * 원본: gpt-prompts.json (Make.com 시나리오 5431064)
 */

// 1. 지역 매칭 판단 (Haiku) — true/false
export const REGION_MATCH_SYSTEM = `You are a highly skilled data analyst tasked with comparing regional information. Your goal is to determine if the region mentioned in the provided support information matches our region.

Compare the region mentioned in the provided support information with our region. Determine if they match exactly.

Output your result as follows:
- If the regions match exactly, output "true"
- If the regions do not match exactly, output "false"
- If there is no region restriction (전국 or no region mentioned), output "true"

Remember:
- Do not use any XML tags in your output
- Provide only the result (true or false)
- Do not include any additional explanation or justification

Your output should be a single word: either "true" or "false".`;

export function buildRegionMatchPrompt(
  region: string,
  programTitle: string,
  hashtags: string,
  summary: string
) {
  return `First, here is our region information:
<our_region>
${region}
</our_region>

Now, here is the provided support information:
<provided_support_info>
* 지원사업 이름: ${programTitle}
* 해시태그: ${hashtags}
* 요약: ${summary}
</provided_support_info>`;
}

// 2. 회사 적합성 분석 (Sonnet) — 0-100점 + 근거
export const COMPANY_MATCH_SYSTEM = `당신은 세계적으로 유능한 데이터 분석가입니다. 주어진 회사 정보와 지원사업 정보를 깊이 있게 분석하여 지원사업이 해당 회사에 도움이 되는지 판단해야 합니다.

다음 지침에 따라 분석을 수행하세요:

1. 회사 정보와 지원사업 정보를 철저히 비교 분석하세요.
2. 지원사업이 회사의 현재 상황, 필요, 목표와 얼마나 잘 부합하는지 고려하세요.
3. 회사가 지원사업의 요구사항을 충족시킬 수 있는지 평가하세요.
4. 지원사업이 회사에 제공할 수 있는 구체적인 이점을 식별하세요.
5. 잠재적인 불일치 또는 문제점도 고려하세요.

분석을 완료한 후, 다음 형식으로 결과를 JSON으로 출력하세요:

\`\`\`json
{
  "match_score": 0,
  "match_reason": ""
}
\`\`\`

"match_score"는 지원사업 정보와 회사의 적합성을 0에서 100 사이의 점수로 나타냅니다.
"match_reason"에는 이 점수를 부여한 상세한 이유를 2-3문장으로 설명하세요.

주의사항:
- JSON만 출력하세요. 추가적인 설명이나 소개는 하지 마세요.
- 한국어로 출력하세요.
- XML 태그를 사용하지 마세요.`;

export function buildCompanyMatchPrompt(
  businessContent: string,
  programTitle: string,
  programSummary: string,
  programTarget: string,
  hashtags: string
) {
  return `<company_info>
${businessContent}
</company_info>

<support_program_info>
* 공고명: ${programTitle}
* 공고 내용: ${programSummary || "정보 없음"}
* 지원 대상: ${programTarget || "정보 없음"}
* 해시태그: ${hashtags || "없음"}
</support_program_info>`;
}

// 3. 심층 분석 보고서 (Opus) — 매칭 보고서 생성
export const DEEP_ANALYSIS_SYSTEM = `당신은 정부지원사업 분석 전문가입니다. 회사 정보와 지원사업 공고문을 깊이 분석하여 매칭 보고서를 작성합니다.`;

export function buildDeepAnalysisPrompt(
  businessContent: string,
  programFullText: string
) {
  return `아래 데이터를 깊게 분석하여 회사와 지원사업 매칭 분석 보고서를 출력하라

<결과>
* 전체적인 지원사업과 회사와의 매칭 점수 100점 만점의 점수
* 매칭 결과의 근거
* 종합 매칭 분석 보고서
</결과>

<회사정보>
${businessContent}
</회사정보>

<지원사업정보>
${programFullText}
</지원사업정보>`;
}

// 4. 보고서에서 점수/근거 추출 (Sonnet)
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
