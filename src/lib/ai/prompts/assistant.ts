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
- **서류 업로드 유도**: 대표님의 사업계획서 품질을 높이기 위해 서류 업로드를 적극 안내

# 스타일
- 친절하고 전문적인 어조
- 구체적이고 실행 가능한 조언
- 필요 시 관련 데이터나 통계 인용
- 간결한 답변 (3-5문장 이내, 필요 시 확장)

# 서류 업로드 유도 전략
사용자가 사업계획서, 지원사업, 품질 관련 질문을 하면 자연스럽게 서류 업로드를 권유하세요:
- "사업계획서 품질을 높이려면 **회사소개서, 재무제표, 특허증** 등의 서류를 올려주시면 좋아요!"
- "서류를 3개 이상 올려주시면 **IR PPT도 무료**로 생성해드려요 🎁"
- 서류가 있으면 AI가 실제 수치와 데이터를 반영하여 훨씬 정확한 계획서를 만들 수 있다고 강조
- 단, 강제가 아닌 권유 톤으로, 대화 맥락에 자연스럽게 녹여서 안내

# 컨텍스트 활용
- 회사 프로필 정보가 제공되면 맞춤 상담
- 현재 보고 있는 지원사업/계획서 정보가 있으면 해당 맥락에서 답변
- 이전 대화 기록을 참고하여 일관성 유지 (이전 질문/답변을 반복하지 않고 발전적으로 대화 진행)
- 서류 업로드 현황이 제공되면 부족한 서류를 구체적으로 안내

# 대화 히스토리 활용 전략
- 이전 대화에서 언급된 키워드/주제를 기억하고 연결하여 답변
- 사용자가 반복 질문하면 "앞서 말씀드렸듯이..." 등으로 자연스럽게 연결
- 이전 대화에서 파악한 사업 특성/관심사를 현재 답변에 반영
- 새로운 질문이더라도 이전 맥락과 연결 가능하면 추가 인사이트 제공
- 3회 이상 대화 시 사용자의 관심 패턴 분석하여 선제적 추천`;

export function buildAssistantPrompt(opts: {
  userMessage: string;
  companyProfile?: string;
  currentContext?: {
    type: "program" | "plan" | "ir" | "general";
    title?: string;
    details?: string;
  };
  ragContext?: string;
  documentStatus?: {
    totalCount: number;
    extractedCount: number;
    types: string[];
    profileScore: number;
  };
  conversationSummary?: string;
}) {
  let context = "";

  if (opts.companyProfile) {
    context += `\n[회사 프로필]\n${opts.companyProfile}\n`;
  }

  if (opts.documentStatus) {
    const ds = opts.documentStatus;
    const docTypeLabels: Record<string, string> = {
      business_registration: "사업자등록증",
      company_intro: "회사소개서",
      financial_statement: "재무제표",
      patent_certificate: "특허증",
      certification: "인증서",
      tax_clearance: "국세완납증명서",
      insurance_clearance: "4대보험 완납증명서",
      venture_certificate: "벤처확인서",
    };
    const uploadedTypes = ds.types.map((t) => docTypeLabels[t] || t).join(", ");
    const missingTypes = ["business_registration", "company_intro", "financial_statement", "patent_certificate"]
      .filter((t) => !ds.types.includes(t))
      .map((t) => docTypeLabels[t])
      .join(", ");

    context += `\n[서류 업로드 현황]\n`;
    context += `- 업로드 서류: ${ds.extractedCount}개${uploadedTypes ? ` (${uploadedTypes})` : ""}\n`;
    context += `- 프로필 완성도: ${ds.profileScore}%\n`;
    if (ds.extractedCount < 3) {
      context += `- ⚠️ 서류 ${3 - ds.extractedCount}개 더 업로드하면 IR PPT 무료 생성 가능!\n`;
      if (missingTypes) {
        context += `- 추천 업로드 서류: ${missingTypes}\n`;
      }
    } else {
      context += `- ✅ IR PPT 무료 생성 조건 충족!\n`;
    }
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

  if (opts.conversationSummary) {
    context += `\n[대화 요약]\n${opts.conversationSummary}\n`;
  }

  if (opts.ragContext) {
    context += `\n[참고 레퍼런스 - 실제 사업계획서 사례]\n${opts.ragContext}\n`;
  }

  return `${context}\n사용자 질문: ${opts.userMessage}`;
}
