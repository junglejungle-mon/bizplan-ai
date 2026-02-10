/**
 * IR PPT 자동 생성 프롬프트
 */

export const IR_SLIDE_TYPES = [
  "cover",
  "problem",
  "solution",
  "market",
  "business_model",
  "traction",
  "competition",
  "tech",
  "team",
  "financials",
  "ask",
  "roadmap",
] as const;

export type SlideType = (typeof IR_SLIDE_TYPES)[number];

export const SLIDE_LABELS: Record<SlideType, string> = {
  cover: "표지",
  problem: "문제 정의",
  solution: "솔루션",
  market: "시장 규모",
  business_model: "비즈니스 모델",
  traction: "트랙션/성과",
  competition: "경쟁 분석",
  tech: "기술/제품 차별성",
  team: "팀 소개",
  financials: "재무 계획",
  ask: "투자 요청",
  roadmap: "로드맵",
};

// IR 슬라이드 콘텐츠 생성 프롬프트
export const IR_GENERATOR_SYSTEM = `당신은 투자유치용 IR PPT 작성 전문가입니다.
사업계획서 데이터를 기반으로 각 슬라이드에 들어갈 콘텐츠를 구조화하여 생성합니다.

# 규칙
1. 투자자 관점에서 임팩트 있는 핵심 메시지 중심
2. 슬라이드당 텍스트는 3-5줄 이내 (간결)
3. 수치/데이터 강조 (구체적인 숫자 포함)
4. 반드시 유효한 JSON만 출력하세요. 설명이나 부연 텍스트 없이 JSON만 출력합니다.

# 슬라이드별 작성 가이드
- cover: headline에 회사 슬로건/비전, subtext에 발표일자
- problem: headline에 해결하려는 핵심 문제, bullets에 시장의 Pain Point 3-4개
- solution: headline에 솔루션 핵심, bullets에 제품/서비스 특징 3-4개
- market: headline에 TAM/SAM/SOM, bullets에 시장 트렌드/성장률
- business_model: headline에 수익모델, bullets에 가격구조/채널
- traction: headline에 핵심 성과 수치, bullets에 매출/고객/파트너십
- competition: headline에 경쟁 우위, bullets에 경쟁사 대비 차별점
- tech: headline에 기술 핵심, bullets에 특허/R&D/기술스택
- team: headline에 팀 소개, bullets에 핵심 인력/경력
- financials: headline에 재무 목표, bullets에 매출 전망/투자금 사용계획
- ask: headline에 투자 요청금액, bullets에 자금 용도/기대 효과
- roadmap: headline에 성장 비전, bullets에 분기별/연도별 마일스톤

# 출력 형식 (반드시 이 형식의 JSON만 출력하세요)
{
  "slides": [
    {
      "slide_type": "cover",
      "title": "슬라이드 제목",
      "content": {
        "headline": "핵심 메시지 한 줄",
        "subtext": "부가 설명",
        "bullets": ["포인트 1", "포인트 2", "포인트 3"]
      },
      "notes": "발표자 노트"
    }
  ]
}

중요: JSON 코드 블록(\`\`\`) 없이 순수 JSON만 출력하세요.`;

export function buildIRGeneratorPrompt(
  companyName: string,
  businessContent: string,
  planSections: Array<{ section_name: string; content: string }>,
  referenceExamples?: string
) {
  const planText = planSections
    .map((s) => `## ${s.section_name}\n${s.content}`)
    .join("\n\n");

  let prompt = `# 회사 정보
회사명: ${companyName}
${businessContent}

# 사업계획서 내용
${planText}`;

  if (referenceExamples) {
    prompt += `\n\n# 선정된 IR 레퍼런스 (실제 선정 사례)
아래는 실제 선정된 IR/PPT에서 유사한 내용입니다. 구조와 임팩트를 참고하세요.

${referenceExamples}`;
  }

  prompt += `\n\n위 사업계획서 내용을 기반으로 투자유치용 IR PPT 슬라이드 12장을 생성하세요.
각 슬라이드 타입: cover, problem, solution, market, business_model, traction, competition, tech, team, financials, ask, roadmap`;

  return prompt;
}
