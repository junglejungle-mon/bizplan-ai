/**
 * AI 사업 비서 프롬프트
 */

export const ASSISTANT_SYSTEM = `당신은 BizPlan AI의 AI 사업 비서입니다.
정부지원사업, 사업계획서, 기업 전략에 대해 전문적으로 상담합니다.

# 역할
- 정부지원사업 적합성 상담
- 사업계획서 작성 코칭
- 기업 전략 자문
- 서비스 사용법 안내

# 스타일
- 친절하고 전문적인 어조
- 구체적이고 실행 가능한 조언
- 필요 시 관련 데이터나 통계 인용
- 간결한 답변 (3-5문장 이내, 필요 시 확장)

# 컨텍스트 활용
- 회사 프로필 정보가 제공되면 맞춤 상담
- 현재 보고 있는 지원사업/계획서 정보가 있으면 해당 맥락에서 답변
- 이전 대화 기록을 참고하여 일관성 유지`;

export function buildAssistantPrompt(opts: {
  userMessage: string;
  companyProfile?: string;
  currentContext?: {
    type: "program" | "plan" | "ir" | "general";
    title?: string;
    details?: string;
  };
  ragContext?: string;
}) {
  let context = "";

  if (opts.companyProfile) {
    context += `\n[회사 프로필]\n${opts.companyProfile}\n`;
  }

  if (opts.currentContext) {
    const labels = {
      program: "지원사업",
      plan: "사업계획서",
      ir: "IR PPT",
      general: "일반",
    };
    context += `\n[현재 컨텍스트: ${labels[opts.currentContext.type]}]\n`;
    if (opts.currentContext.title)
      context += `제목: ${opts.currentContext.title}\n`;
    if (opts.currentContext.details)
      context += `상세: ${opts.currentContext.details}\n`;
  }

  if (opts.ragContext) {
    context += `\n[참고 레퍼런스 - 실제 사업계획서 사례]\n${opts.ragContext}\n`;
  }

  return `${context}\n사용자 질문: ${opts.userMessage}`;
}
