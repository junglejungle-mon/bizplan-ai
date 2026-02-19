/**
 * 관리자 감사 로그 (Audit Log)
 *
 * 관리자의 데이터 변경 작업을 기록합니다.
 * 현재: 구조화 로깅 (Pino) + Supabase DB
 * 향후: 별도 감사 DB, S3 백업 등 확장 가능
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("admin-audit");

export type AuditAction =
  | "admin.login"
  | "admin.logout"
  | "user.view"
  | "user.update"
  | "user.delete"
  | "plan.view"
  | "plan.update"
  | "plan.delete"
  | "plan.export"
  | "company.view"
  | "company.update"
  | "program.update"
  | "program.delete"
  | "subscription.update"
  | "subscription.cancel"
  | "payment.refund"
  | "reference.process"
  | "reference.update"
  | "reference.delete"
  | "quality.score"
  | "quality.pattern_update"
  | "agent.meeting_trigger"
  | "agent.meeting_run"
  | "agent.mission_approve"
  | "agent.mission_reject";

interface AuditEntry {
  action: AuditAction;
  /** 대상 리소스 ID (사용자ID, 계획서ID 등) */
  targetId?: string;
  /** 대상 리소스 타입 */
  targetType?: string;
  /** 변경 내용 요약 */
  details?: Record<string, unknown>;
  /** 요청 IP */
  ip?: string;
}

/**
 * 감사 로그 기록
 *
 * 사용법:
 *   await auditLog({
 *     action: "payment.refund",
 *     targetId: paymentId,
 *     targetType: "payment",
 *     details: { reason, amount },
 *     ip: getClientIP(request),
 *   });
 */
export async function auditLog(entry: AuditEntry): Promise<void> {
  const timestamp = new Date().toISOString();

  // 1. 구조화 로깅 (항상)
  log.info(
    {
      audit: true,
      ...entry,
      timestamp,
    },
    `[AUDIT] ${entry.action}${entry.targetId ? ` → ${entry.targetType}:${entry.targetId}` : ""}`
  );

  // 2. DB 저장 (비동기, 실패해도 무시)
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    await supabase.from("admin_audit_logs").insert({
      action: entry.action,
      target_id: entry.targetId || null,
      target_type: entry.targetType || null,
      details: entry.details || {},
      ip_address: entry.ip || null,
      created_at: timestamp,
    });
  } catch {
    // DB 저장 실패 시 로그만 남기고 계속 진행
    // (테이블이 없어도 앱이 죽지 않음)
    log.warn({ action: entry.action }, "[AUDIT] DB 저장 실패 (로그만 기록됨)");
  }
}
