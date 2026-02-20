/**
 * GA4 Analytics 유틸리티
 * - 전환 퍼널: 가입 → 온보딩 → 계획서 생성 → 결제
 * - 커스텀 이벤트: 핵심 사용자 행동 추적
 */

// gtag 타입 선언
type GtagCommand = "config" | "event" | "set";

interface GtagEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  // 커스텀 파라미터
  method?: string;
  plan_name?: string;
  plan_id?: string;
  plan_price?: number;
  program_id?: string;
  program_name?: string;
  match_score?: number;
  round?: number;
  total_rounds?: number;
  completion_rate?: number;
  quality_score?: number;
  section_count?: number;
  template_id?: string;
  query?: string;
  results_count?: number;
  currency?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

declare global {
  interface Window {
    gtag?: (command: GtagCommand, action: string, params?: GtagEventParams) => void;
  }
}

/** GA4 이벤트 전송 (gtag 없으면 무시) */
function sendEvent(eventName: string, params?: GtagEventParams): void {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
}

// ============================================================
// 1. 인증 & 가입 퍼널
// ============================================================

/** 회원가입 완료 */
export function trackSignUp(method: string): void {
  sendEvent("sign_up", { method, event_category: "auth" });
}

/** 로그인 */
export function trackLogin(method: string): void {
  sendEvent("login", { method, event_category: "auth" });
}

/** 로그아웃 */
export function trackLogout(): void {
  sendEvent("logout", { event_category: "auth" });
}

// ============================================================
// 2. 온보딩 퍼널
// ============================================================

/** 온보딩 인터뷰 시작 */
export function trackOnboardingStart(): void {
  sendEvent("onboarding_start", { event_category: "onboarding" });
}

/** 온보딩 인터뷰 라운드 완료 */
export function trackOnboardingRound(round: number, totalRounds: number): void {
  sendEvent("onboarding_round_complete", {
    event_category: "onboarding",
    round,
    total_rounds: totalRounds,
    completion_rate: Math.round((round / totalRounds) * 100),
  });
}

/** 온보딩 인터뷰 전체 완료 */
export function trackOnboardingComplete(totalRounds: number): void {
  sendEvent("onboarding_complete", {
    event_category: "onboarding",
    total_rounds: totalRounds,
  });
}

/** 온보딩 이탈 (중간에 나감) */
export function trackOnboardingDrop(round: number, totalRounds: number): void {
  sendEvent("onboarding_drop", {
    event_category: "onboarding",
    round,
    total_rounds: totalRounds,
    completion_rate: Math.round((round / totalRounds) * 100),
  });
}

// ============================================================
// 3. 사업계획서 퍼널
// ============================================================

/** 사업계획서 생성 시작 */
export function trackPlanGenerateStart(planId: string): void {
  sendEvent("plan_generate_start", {
    event_category: "plan",
    plan_id: planId,
  });
}

/** 사업계획서 생성 완료 */
export function trackPlanGenerateComplete(
  planId: string,
  sectionCount: number,
  qualityScore?: number,
): void {
  sendEvent("plan_generate_complete", {
    event_category: "plan",
    plan_id: planId,
    section_count: sectionCount,
    quality_score: qualityScore,
  });
}

/** 사업계획서 다운로드 */
export function trackPlanDownload(
  planId: string,
  format: "docx" | "pdf" | "md",
): void {
  sendEvent("plan_download", {
    event_category: "plan",
    plan_id: planId,
    event_label: format,
  });
}

/** 사업계획서 조회 */
export function trackPlanView(planId: string): void {
  sendEvent("plan_view", {
    event_category: "plan",
    plan_id: planId,
  });
}

// ============================================================
// 4. 지원사업 매칭
// ============================================================

/** 지원사업 검색 */
export function trackProgramSearch(query: string, resultsCount: number): void {
  sendEvent("program_search", {
    event_category: "program",
    query,
    results_count: resultsCount,
  });
}

/** 지원사업 상세 보기 */
export function trackProgramView(programId: string, programName: string): void {
  sendEvent("program_view", {
    event_category: "program",
    program_id: programId,
    program_name: programName,
  });
}

/** 지원사업 매칭 실행 */
export function trackProgramMatch(matchScore: number): void {
  sendEvent("program_match", {
    event_category: "program",
    match_score: matchScore,
  });
}

// ============================================================
// 5. 결제 퍼널
// ============================================================

/** 요금제 페이지 조회 */
export function trackPricingView(): void {
  sendEvent("pricing_view", { event_category: "payment" });
}

/** 결제 시작 */
export function trackPaymentStart(planName: string, planPrice: number): void {
  sendEvent("begin_checkout", {
    event_category: "payment",
    plan_name: planName,
    value: planPrice,
    currency: "KRW",
  });
}

/** 결제 완료 */
export function trackPaymentComplete(
  planName: string,
  planPrice: number,
): void {
  sendEvent("purchase", {
    event_category: "payment",
    plan_name: planName,
    value: planPrice,
    currency: "KRW",
  });
}

/** 결제 실패 */
export function trackPaymentFail(planName: string, reason?: string): void {
  sendEvent("payment_fail", {
    event_category: "payment",
    plan_name: planName,
    event_label: reason,
  });
}

// ============================================================
// 6. IR PPT
// ============================================================

/** IR PPT 생성 시작 */
export function trackIRGenerateStart(templateId: string): void {
  sendEvent("ir_generate_start", {
    event_category: "ir",
    template_id: templateId,
  });
}

/** IR PPT 다운로드 */
export function trackIRDownload(planId: string): void {
  sendEvent("ir_download", {
    event_category: "ir",
    plan_id: planId,
  });
}

// ============================================================
// 7. AI 컨설턴트
// ============================================================

/** AI 컨설턴트 대화 시작 */
export function trackConsultantStart(): void {
  sendEvent("consultant_start", { event_category: "consultant" });
}

/** AI 사업 비서 열기 */
export function trackAssistantOpen(): void {
  sendEvent("assistant_open", { event_category: "assistant" });
}

// ============================================================
// 8. 사용자 참여
// ============================================================

/** 회사 프로필 저장 */
export function trackProfileSave(completionRate: number): void {
  sendEvent("profile_save", {
    event_category: "engagement",
    completion_rate: completionRate,
  });
}

/** 서류 업로드 */
export function trackDocumentUpload(fileType: string): void {
  sendEvent("document_upload", {
    event_category: "engagement",
    event_label: fileType,
  });
}

/** 스케줄러 사용 */
export function trackSchedulerView(matchedCount: number): void {
  sendEvent("scheduler_view", {
    event_category: "engagement",
    results_count: matchedCount,
  });
}
