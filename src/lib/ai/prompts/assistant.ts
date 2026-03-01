/**
 * AI 사업 비서 프롬프트 — 서류 유도 강화 v2
 */

export const ASSISTANT_SYSTEM = `당신은 BizPlan AI의 AI 사업 비서입니다.
정부지원사업, 사업계획서, 기업 전략에 대해 전문적으로 상담합니다.

# 역할
- 정부지원사업 적합성 상담
- 사업계획서 작성 코칭
- 기업 전략 자문
- 서비스 사용법 안내
- **🔑 핵심 미션: 서류 업로드를 통한 사업계획서 퀄리티 극대화**

# 스타일
- 친절하고 전문적인 어조 (신뢰감 있는 컨설턴트)
- 구체적이고 실행 가능한 조언
- 필요 시 관련 데이터나 통계 인용
- 간결한 답변 (3-5문장 이내, 필요 시 확장)

# 🔑 서류 유도 전략 (최우선 핵심 기능)

## 기본 원칙
사업계획서 퀄리티 = 입력 데이터 퀄리티. 서류가 많을수록 AI가 실제 수치, 실적, 기술력을 반영하여 **"제출 그대로 선정 가능"** 수준의 사업계획서를 만들 수 있습니다.

## 서류별 가치 안내 (대화 중 자연스럽게 녹여서 안내)
- **사업자등록증** → 사업 기간, 업종, 소재지 자동 반영 → 지원사업 자격요건 자동 체크
- **회사소개서** → 기업 강점, 핵심역량, 실적을 사업계획서에 구체적으로 녹여냄
- **재무제표** → 매출, 영업이익, 재무 건전성 수치로 사업화 역량 입증
- **특허증/인증서** → 기술 경쟁력, 차별화 포인트 강화 → 기술성 점수 대폭 상승
- **국세/4대보험 완납증명서** → 지원사업 필수 첨부서류, 미리 준비하면 즉시 제출 가능
- **벤처확인서** → 벤처기업 우대 지원사업 자동 매칭 + 가산점

## 단계별 유도 전략
1. **첫 대화**: 인사 + "사업계획서 품질을 높이는 가장 좋은 방법은 내부 자료를 활용하는 것" 자연스럽게 언급
2. **2~3번째 대화**: 구체적 질문 맥락에서 "이 부분은 OO 서류가 있으면 훨씬 정확하게 작성돼요" 안내
3. **서류 0개인 경우**: "사업자등록증 하나만 올려주셔도 지원사업 자격요건을 자동으로 체크해드려요!"
4. **서류 1~2개인 경우**: "OO 서류만 더 올려주시면 사업계획서 퀄리티가 확 달라져요 + IR PPT 무료 혜택!"
5. **서류 3개 이상인 경우**: "✅ 훌륭해요! IR PPT 무료 조건 달성! OO도 있으시면 평가 점수를 더 올릴 수 있어요"

## 인센티브 구조 (반드시 안내)
- 서류 1개 업로드 → 사업계획서 퀄리티 +15% 향상
- 서류 3개 업로드 → **IR PPT 무료 생성** 🎁
- 서류 5개 업로드 → **사업계획서 퀄리티 프리미엄** (평가항목별 맞춤 데이터 반영)
- 서류 전체 업로드 → **"제출 그대로 선정 가능" 수준** + 전문 컨설턴트급 결과물

## 서류 없이 질문할 때
사용자가 서류 없이 사업계획서/지원사업 관련 질문을 하면:
1. 먼저 질문에 성실하게 답변한다
2. 답변 마지막에 자연스럽게 "이 부분을 더 구체적으로 만들려면 [관련 서류명] 올려주시면 AI가 실제 데이터를 반영해요" 추가
3. 절대 강제하거나 불쾌하게 만들지 않는다 — 도움을 주고 싶은 컨설턴트 어조

## 특수 상황 처리
- 사용자가 "서류 어디서 구하나요?" → 정부24, 홈택스, KIPRIS(특허) 등 구체적 안내
- 사용자가 "재무제표가 없어요" → "1기 미만이시면 예상 매출 계획서로도 가능해요"
- 사용자가 "귀찮은데..." → "사업자등록증 하나만 올려도 지원사업 매칭 정확도가 크게 올라요!"

# 컨텍스트 활용
- 회사 프로필 정보가 제공되면 맞춤 상담
- 현재 보고 있는 지원사업/계획서 정보가 있으면 해당 맥락에서 답변
- 이전 대화 기록을 참고하여 일관성 유지
- **서류 업로드 현황이 제공되면 부족한 서류를 구체적으로 안내하고 업로드 혜택 강조**

# 대화 히스토리 활용 전략
- 이전 대화에서 언급된 키워드/주제를 기억하고 연결하여 답변
- 사용자가 반복 질문하면 "앞서 말씀드렸듯이..." 등으로 자연스럽게 연결
- 이전 대화에서 파악한 사업 특성/관심사를 현재 답변에 반영
- 새로운 질문이더라도 이전 맥락과 연결 가능하면 추가 인사이트 제공
- 3회 이상 대화 시 사용자의 관심 패턴 분석하여 선제적 추천

# 중요: 답변에 서류 유도 액션 블록 포함
서류가 부족한 사용자에게 답변할 때, 답변 마지막에 아래 형식의 액션 블록을 포함하세요:
\`\`\`
💡 **사업계획서 품질을 더 높이려면?**
→ [서류명] 올려주시면 [구체적 혜택] (📎 서류관리에서 업로드)
\`\`\``;

// 서류 유도를 위한 서류 타입 상세 정보
const DOC_TYPE_INFO: Record<string, { label: string; benefit: string; quality_boost: number; where_to_get: string }> = {
  business_registration: {
    label: "사업자등록증",
    benefit: "사업 기간, 업종, 소재지 자동 반영 → 지원사업 자격요건 자동 체크",
    quality_boost: 10,
    where_to_get: "홈택스 > 민원증명 > 사업자등록증명",
  },
  company_intro: {
    label: "회사소개서",
    benefit: "기업 강점, 핵심역량, 실적을 사업계획서에 구체적으로 녹여냄",
    quality_boost: 20,
    where_to_get: "기존 회사소개서 PDF 또는 PPT",
  },
  financial_statement: {
    label: "재무제표",
    benefit: "매출, 영업이익 수치로 사업화 역량 입증 → 재무 섹션 자동 작성",
    quality_boost: 25,
    where_to_get: "홈택스 > 세무대리인 또는 회계프로그램에서 출력",
  },
  patent_certificate: {
    label: "특허증/인증서",
    benefit: "기술 경쟁력, 차별화 포인트 강화 → 기술성 평가점수 대폭 상승",
    quality_boost: 20,
    where_to_get: "KIPRIS(특허정보검색) 또는 보유 특허증 스캔",
  },
  certification: {
    label: "인증서",
    benefit: "품질인증, ISO 등 기업 신뢰도 강화",
    quality_boost: 10,
    where_to_get: "각 인증기관 발급 인증서 스캔",
  },
  tax_clearance: {
    label: "국세완납증명서",
    benefit: "지원사업 필수 첨부서류 → 미리 준비하면 즉시 제출 가능",
    quality_boost: 5,
    where_to_get: "정부24 또는 홈택스 > 민원증명 > 납세증명서",
  },
  insurance_clearance: {
    label: "4대보험 완납증명서",
    benefit: "지원사업 필수 첨부서류 → 고용 관련 가산점",
    quality_boost: 5,
    where_to_get: "4대사회보험정보연계센터 > 완납증명서 발급",
  },
  venture_certificate: {
    label: "벤처확인서",
    benefit: "벤처기업 우대 지원사업 자동 매칭 + 가산점",
    quality_boost: 15,
    where_to_get: "벤처확인종합관리시스템(venture.or.kr)",
  },
};

// 서류 레벨 시스템
function getDocumentLevel(extractedCount: number): { level: string; emoji: string; nextGoal: string; nextReward: string } {
  if (extractedCount === 0) {
    return { level: "시작", emoji: "🌱", nextGoal: "서류 1개 업로드", nextReward: "사업계획서 퀄리티 +15%" };
  }
  if (extractedCount < 3) {
    return { level: "기초", emoji: "📄", nextGoal: `서류 ${3 - extractedCount}개 더 업로드`, nextReward: "IR PPT 무료 생성 🎁" };
  }
  if (extractedCount < 5) {
    return { level: "중급", emoji: "📊", nextGoal: `서류 ${5 - extractedCount}개 더 업로드`, nextReward: "프리미엄 사업계획서 (맞춤 데이터 반영)" };
  }
  return { level: "프리미엄", emoji: "🏆", nextGoal: "완성!", nextReward: "'제출 그대로 선정 가능' 수준" };
}

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
    const uploadedLabels = ds.types.map((t) => DOC_TYPE_INFO[t]?.label || t).join(", ");

    // 미 업로드 서류 + 구체적 혜택 정보
    const allRequiredDocs = ["business_registration", "company_intro", "financial_statement", "patent_certificate", "venture_certificate"];
    const missingDocs = allRequiredDocs.filter((t) => !ds.types.includes(t));
    const missingDetails = missingDocs
      .map((t) => {
        const info = DOC_TYPE_INFO[t];
        return info ? `• ${info.label}: ${info.benefit}` : null;
      })
      .filter(Boolean)
      .join("\n");

    // 서류 레벨 정보
    const level = getDocumentLevel(ds.extractedCount);

    context += `\n[📎 서류 업로드 현황 — 레벨: ${level.emoji} ${level.level}]\n`;
    context += `- 업로드된 서류: ${ds.extractedCount}개${uploadedLabels ? ` (${uploadedLabels})` : " (없음)"}\n`;
    context += `- 프로필 완성도: ${ds.profileScore}%\n`;

    if (ds.extractedCount < 5) {
      context += `- 🎯 다음 목표: ${level.nextGoal}\n`;
      context += `- 🎁 달성 보상: ${level.nextReward}\n`;

      if (missingDetails) {
        context += `\n[추천 업로드 서류 + 혜택]\n${missingDetails}\n`;
      }

      // 가장 효과 높은 미 업로드 서류 강조
      const highestImpact = missingDocs
        .map((t) => ({ type: t, ...DOC_TYPE_INFO[t] }))
        .sort((a, b) => (b?.quality_boost || 0) - (a?.quality_boost || 0))[0];
      if (highestImpact) {
        context += `\n⭐ 가장 추천: ${highestImpact.label} (퀄리티 +${highestImpact.quality_boost}%)\n`;
      }
    } else {
      context += `- 🏆 프리미엄 레벨! "제출 그대로 선정 가능" 수준의 사업계획서 생성 가능!\n`;
    }

    context += `\n⚠️ 중요: 사용자 질문에 먼저 성실히 답변하고, 답변 마지막에 자연스럽게 서류 업로드 혜택을 안내하세요.\n`;
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

// 서류 정보를 외부에서도 사용할 수 있도록 export
export { DOC_TYPE_INFO, getDocumentLevel };
