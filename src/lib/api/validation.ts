/**
 * API 입력값 검증 유틸리티 (zod 기반)
 *
 * 핵심 POST/PATCH 엔드포인트에 사용합니다.
 * - 스키마 정의
 * - 검증 실패 시 400 응답 자동 생성
 */

import { z, ZodSchema, ZodError } from "zod";

// ─── 검증 헬퍼 ─────────────────────────────────

/**
 * 요청 body를 zod 스키마로 검증
 * @returns [data, null] if valid, [null, Response] if invalid
 */
export async function validateBody<T>(
  request: Request,
  schema: ZodSchema<T>
): Promise<[T, null] | [null, Response]> {
  try {
    const raw = await request.json();
    const data = schema.parse(raw);
    return [data, null];
  } catch (error) {
    if (error instanceof ZodError) {
      const messages = error.issues.map(
        (e) => `${String(e.path.join("."))}: ${e.message}`
      );
      return [
        null,
        Response.json(
          { error: "입력값이 올바르지 않습니다", details: messages },
          { status: 400 }
        ),
      ];
    }
    // JSON 파싱 실패 등
    return [
      null,
      Response.json(
        { error: "요청 본문을 파싱할 수 없습니다" },
        { status: 400 }
      ),
    ];
  }
}

// ─── 공통 스키마 ────────────────────────────────

/** UUID v4 문자열 */
const uuid = z.string().uuid("유효한 UUID가 아닙니다");

/** 안전한 문자열 (XSS 방지 — 스크립트 태그 + 이벤트 핸들러 + javascript: 프로토콜 제거) */
const safeString = (maxLen = 500) =>
  z.string().max(maxLen).transform((s) =>
    s
      .replace(/<script[\s>]/gi, "")          // <script> 태그
      .replace(/<\/script>/gi, "")              // </script> 닫기
      .replace(/on\w+\s*=/gi, "")               // onerror=, onload=, onclick= 등
      .replace(/javascript\s*:/gi, "")          // javascript: 프로토콜
      .replace(/data\s*:\s*text\/html/gi, "")   // data:text/html 프로토콜
  );

// ─── Admin Auth ─────────────────────────────────

export const adminLoginSchema = z.object({
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

// ─── 결제 관련 ──────────────────────────────────

export const checkoutSchema = z.object({
  planId: uuid,
});

export const verifyPaymentSchema = z.object({
  paymentId: z.string().min(1, "결제 ID가 필요합니다"),
  planId: uuid,
});

export const refundSchema = z.object({
  paymentId: uuid,
  reason: z
    .string()
    .min(2, "환불 사유를 2자 이상 입력해주세요")
    .max(500, "환불 사유는 500자 이내로 입력해주세요"),
});

// ─── 관리자 환불 ────────────────────────────────

export const adminRefundSchema = z.object({
  reason: safeString(500).optional(),
  amount: z.number().positive().optional(),
});

// ─── 사업계획서 ─────────────────────────────────

export const createPlanSchema = z.object({
  programId: uuid.optional(),
  title: safeString(200).optional(),
});

export const updatePlanSchema = z.object({
  title: safeString(200).optional(),
  status: z.enum(["draft", "generating", "completed", "archived"]).optional(),
});

// ─── 문의 ───────────────────────────────────────

export const contactSchema = z.object({
  name: safeString(100),
  email: z.string().email("유효한 이메일을 입력해주세요"),
  category: safeString(50),
  message: safeString(2000),
  phone: z.string().max(20).optional(),
  company: safeString(100).optional(),
});

// ─── 에이전트 미션 승인 ─────────────────────────

export const missionApprovalSchema = z.object({
  action: z.enum(["approve", "reject", "defer"]),
  reason: safeString(500).optional(),
});

// ─── 에이전트 회의 ──────────────────────────────

export const meetingTriggerSchema = z.object({
  type: z.enum(["weekly", "monthly"]).default("weekly"),
});

// ─── 프로그램 수정 ──────────────────────────────

export const updateProgramSchema = z.object({
  title: safeString(200).optional(),
  institution: safeString(100).optional(),
  target: safeString(500).optional(),
  status: z.enum(["active", "expired", "upcoming"]).optional(),
}).strict();

// ─── 구독 수정 (관리자) ─────────────────────────

export const updateSubscriptionSchema = z.object({
  status: z.enum(["active", "expired", "canceled", "trialing"]).optional(),
  cancel_reason: safeString(500).optional(),
}).strict();

// ─── 기업 정보 수정 ─────────────────────────────

export const updateCompanySchema = z.object({
  name: safeString(100).optional(),
  industry: safeString(100).optional(),
  region: safeString(100).optional(),
  business_content: safeString(2000).optional(),
  employee_count: z.number().int().min(0).max(1000000).optional(),
  revenue: z.string().max(50).optional(),
}).strict();

// ─── AI 어시스턴트 채팅 ──────────────────────────────

export const chatMessageSchema = z.object({
  message: safeString(2000),
  contextType: z.enum(["program", "plan", "general", "ir"]).optional(),
  contextId: z.string().uuid().optional(),
});

// ─── 매칭 ────────────────────────────────────────────

export const runMatchingSchema = z.object({
  companyId: z.string().uuid("유효한 companyId가 아닙니다"),
});

// ─── 업그레이드 ──────────────────────────────────────

export const upgradeSchema = z.object({
  planId: z.string().uuid("유효한 planId가 아닙니다"),
});

// ─── 추천 코드 검증 ──────────────────────────────────

export const referralVerifySchema = z.object({
  code: z.string().min(1, "추천 코드를 입력해주세요").max(50),
});

// ─── 추천 공유 이벤트 ────────────────────────────────

export const referralShareSchema = z.object({
  shareType: z.enum(["share_kakao", "share_link", "share_copy"]),
});

// ─── 추천 처리 ───────────────────────────────────────

export const referralProcessSchema = z.object({
  referralCode: z.string().min(1, "추천 코드가 필요합니다").max(50),
});

// ─── AI 인터뷰 ───────────────────────────────────────

export const interviewAnswerSchema = z.object({
  companyId: z.string().uuid("유효한 companyId가 아닙니다"),
  answer: safeString(3000).optional(),
  currentRound: z.number().int().min(0).max(20),
  questionOrder: z.number().int().min(-1),
});

// ─── 인터뷰 인사이트 ─────────────────────────────────

export const interviewInsightsSchema = z.object({
  companyId: z.string().uuid("유효한 companyId가 아닙니다"),
});

// ─── 인터뷰 리셋 ─────────────────────────────────────

export const interviewResetSchema = z.object({
  companyId: z.string().uuid("유효한 companyId가 아닙니다"),
});

// ─── 섹션 내용 수정 ──────────────────────────────────

export const updateSectionContentSchema = z.object({
  content: z.string().max(50000, "내용이 너무 깁니다"),
});

// ─── 관리자 환불 처리 ────────────────────────────────

export const adminPaymentRefundSchema = z.object({
  reason: safeString(500).optional(),
  forceRefund: z.boolean().optional(),
});

// ─── 품질 점수 (관리자) ──────────────────────────────

export const adminScorePlanSchema = z.object({
  planId: z.string().uuid("유효한 planId가 아닙니다"),
});

// ─── 레퍼런스 수정 (관리자) ──────────────────────────

export const updateReferenceSchema = z.object({
  title: safeString(200).optional(),
  reference_type: z.string().max(50).optional(),
  template_type: z.string().max(50).optional(),
});

// ─── 서류 메타데이터 저장 ────────────────────────────

export const createDocumentSchema = z.object({
  documentType: z.string().min(1, "documentType이 필요합니다").max(100),
  source: z.string().max(100).optional(),
  fileUrl: z.string().url("유효한 URL이 아닙니다").optional(),
  issuedDate: z.string().max(20).optional(),
});

// ─── 서류 데이터 추출 ────────────────────────────────

export const extractDocumentSchema = z.object({
  documentId: z.string().uuid("유효한 documentId가 아닙니다"),
});

// ─── 알림 발송 ───────────────────────────────────────

export const sendNotificationSchema = z.object({
  type: z.enum(["matching", "deadline", "plan_complete"]),
  variables: z.record(z.string(), z.string()).optional(),
});

// ─── 차트 재추출 ─────────────────────────────────────

export const extractChartsSchema = z.object({
  sectionName: z.string().min(1, "sectionName이 필요합니다").max(200),
  sectionContent: z.string().min(1, "sectionContent가 필요합니다").max(50000),
  sectionOrder: z.number().int().min(1).optional(),
});

// ─── 차트 커스터마이징 ───────────────────────────────

export const customizeChartsSchema = z.object({
  userPrompt: safeString(500).optional(),
  sectionOrder: z.number().int().min(1).optional(),
  sectionName: z.string().min(1, "sectionName이 필요합니다").max(200),
  targetChartIndex: z.number().int().min(0).optional(),
  presetId: z.string().max(100).optional(),
});

// ─── 패턴 수정 (관리자) ──────────────────────────────

export const updatePatternSchema = z.object({
  id: z.string().uuid("유효한 id가 아닙니다"),
}).passthrough();

// ─── 구독 수정 (관리자) — 허용 필드 명시 ────────────

export const adminUpdateSubscriptionSchema = z.object({
  status: z.enum(["active", "expired", "canceled", "trialing"]).optional(),
  plan_id: z.string().uuid().optional(),
  current_period_end: z.string().optional(),
  cancel_at_period_end: z.boolean().optional(),
});

// ─── 프로그램 수정 (관리자) — 허용 필드 명시 ────────

export const adminUpdateProgramSchema = z.object({
  title: safeString(200).optional(),
  summary: safeString(1000).optional(),
  target: safeString(500).optional(),
  institution: safeString(100).optional(),
  apply_start: z.string().max(50).optional(),
  apply_end: z.string().max(50).optional(),
  detail_url: z.string().url().optional().or(z.literal("")),
  hashtags: z.array(z.string().max(50)).optional(),
});

export { z };
