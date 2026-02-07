/**
 * 사업계획서 자동 작성 프롬프트 (기존 GPT → Claude 이식)
 * 원본: gpt-prompts.json (Make.com 시나리오 5454578)
 */

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

// 5. 섹션 작성 (Sonnet — 핵심)
export const SECTION_WRITER_SYSTEM = `당신은 대한민국 정부지원사업 사업계획서 작성 전문가입니다.

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

# 포맷
- 마크다운 형식으로 작성
- 소제목, 불릿 포인트, 표를 적극 활용
- 분량: 섹션당 400-800자`;

export function buildSectionWriterPrompt(opts: {
  sectionName: string;
  guidelines: string;
  businessContent: string;
  previousSections: string;
  evaluationWeight?: number;
  researchKo?: string;
  researchEn?: string;
}) {
  let prompt = `# 작성 대상 섹션
**섹션명**: ${opts.sectionName}
**작성 지침**: ${opts.guidelines || "자유 서술"}
${opts.evaluationWeight ? `**평가 배점**: ${opts.evaluationWeight}점 (높은 배점 → 더 상세히 작성)` : ""}

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

  prompt += `\n\n위 정보를 바탕으로 "${opts.sectionName}" 섹션을 작성하세요. 마크다운 형식으로 출력하세요.`;

  return prompt;
}

// 6. 기본 섹션 템플릿 (양식 OCR이 없을 때)
export const DEFAULT_SECTIONS = [
  {
    section_name: "사업 개요",
    guidelines: "사업의 배경, 목적, 필요성을 기술. 해결하려는 문제와 시장 기회 제시",
    section_order: 1,
  },
  {
    section_name: "기업 현황",
    guidelines: "기업 연혁, 조직 구성, 보유 기술/역량, 주요 실적 기술",
    section_order: 2,
  },
  {
    section_name: "기술 개발 내용",
    guidelines: "개발하려는 기술/제품의 핵심 내용, 차별성, 기술적 우위 기술",
    section_order: 3,
  },
  {
    section_name: "시장 분석",
    guidelines: "TAM/SAM/SOM 시장 규모, 목표 시장, 경쟁 분석, 시장 트렌드",
    section_order: 4,
  },
  {
    section_name: "사업화 전략",
    guidelines: "제품화/서비스화 전략, 판로 개척, 마케팅, 수익 모델",
    section_order: 5,
  },
  {
    section_name: "추진 일정",
    guidelines: "연차별/분기별 추진 계획, 마일스톤, 성과 지표",
    section_order: 6,
  },
  {
    section_name: "소요 예산",
    guidelines: "항목별 예산 계획, 자부담/정부지원 비율, 투자 계획",
    section_order: 7,
  },
  {
    section_name: "기대 효과",
    guidelines: "기술적/경제적/사회적 기대 효과, 고용 창출, 매출 목표",
    section_order: 8,
  },
];
