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

/** 안전한 문자열 (XSS 기본 방지) */
const safeString = (maxLen = 500) =>
  z.string().max(maxLen).transform((s) => s.replace(/<script/gi, ""));

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
}).passthrough(); // 추가 필드 허용

// ─── 구독 수정 (관리자) ─────────────────────────

export const updateSubscriptionSchema = z.object({
  status: z.enum(["active", "expired", "canceled", "trialing"]).optional(),
  cancel_reason: safeString(500).optional(),
}).passthrough();

// ─── 기업 정보 수정 ─────────────────────────────

export const updateCompanySchema = z.object({
  name: safeString(100).optional(),
  industry: safeString(100).optional(),
  region: safeString(100).optional(),
  business_content: safeString(2000).optional(),
  employee_count: z.number().int().min(0).max(1000000).optional(),
  revenue: z.string().max(50).optional(),
}).passthrough();

export { z };
