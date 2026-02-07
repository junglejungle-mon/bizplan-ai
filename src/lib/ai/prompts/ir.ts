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
3. 수치/데이터 강조
4. JSON 형식으로 출력

# 출력 형식
\`\`\`json
{
  "slides": [
    {
      "slide_type": "cover",
      "title": "슬라이드 제목",
      "content": {
        "headline": "핵심 메시지 한 줄",
        "subtext": "부가 설명",
        "bullets": ["포인트 1", "포인트 2"],
        "data": {"key": "value"}
      },
      "notes": "발표자 노트"
    }
  ]
}
\`\`\``;

export function buildIRGeneratorPrompt(
  companyName: string,
  businessContent: string,
  planSections: Array<{ section_name: string; content: string }>
) {
  const planText = planSections
    .map((s) => `## ${s.section_name}\n${s.content}`)
    .join("\n\n");

  return `# 회사 정보
회사명: ${companyName}
${businessContent}

# 사업계획서 내용
${planText}

위 사업계획서 내용을 기반으로 투자유치용 IR PPT 슬라이드 12장을 생성하세요.
각 슬라이드 타입: cover, problem, solution, market, business_model, traction, competition, tech, team, financials, ask, roadmap`;
}
