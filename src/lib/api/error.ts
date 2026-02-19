/**
 * API 에러 응답 안전 유틸리티
 *
 * DB 에러 메시지, 내부 구현 세부사항이 클라이언트에
 * 노출되지 않도록 안전한 메시지만 반환합니다.
 */

/**
 * 클라이언트에 안전하게 노출 가능한 에러 메시지 반환
 *
 * - 사전 정의된 사용자 친화적 메시지는 그대로 반환
 * - DB 에러, 스택 트레이스 등 민감 정보는 generic 메시지로 대체
 * - 개발 환경에서는 원본 메시지도 함께 로깅
 *
 * @param error - 원본 에러 (unknown 타입)
 * @param fallback - 기본 에러 메시지
 * @returns 안전한 에러 메시지 문자열
 */
export function safeErrorMessage(error: unknown, fallback = "요청 처리 중 오류가 발생했습니다"): string {
  if (!(error instanceof Error)) return fallback;

  const msg = error.message;

  // 안전한 한국어 사용자 메시지는 통과
  if (SAFE_PATTERNS.some((p) => msg.startsWith(p))) {
    return msg;
  }

  // DB/인프라 에러 패턴 감지 → 차단
  if (UNSAFE_PATTERNS.some((p) => msg.toLowerCase().includes(p))) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[safeErrorMessage] Blocked:", msg);
    }
    return fallback;
  }

  // 짧고 ASCII가 아닌 메시지 (한국어 사용자 메시지일 가능성)는 통과
  if (msg.length <= 100 && /[가-힣]/.test(msg)) {
    return msg;
  }

  // 나머지는 차단
  return fallback;
}

/** 사용자에게 안전하게 보여줄 수 있는 메시지 시작 패턴 */
const SAFE_PATTERNS = [
  "이미 ",
  "필수 ",
  "잘못된 ",
  "존재하지 ",
  "권한이 ",
  "인증이 ",
  "유효하지 ",
  "사용할 수 없",
  "찾을 수 없",
  "시간이 초과",
  "요청이 ",
  "지원하지 ",
];

/** DB/인프라 에러 패턴 — 이것들이 포함되면 차단 */
const UNSAFE_PATTERNS = [
  "relation ",       // PostgreSQL
  "column ",         // PostgreSQL
  "violates ",       // constraint violation
  "duplicate key",   // unique constraint
  "foreign key",     // FK violation
  "null value",      // NOT NULL
  "syntax error",    // SQL syntax
  "permission denied",
  "connect econnrefused",
  "enotfound",
  "timeout exceeded",
  "socket hang up",
  "certificate",
  "jwt ",
  "token ",
  "secret",
  "password",
  "api_key",
  "apikey",
  "supabase",
  "postgres",
  "redis",
  "prisma",
  "drizzle",
  "pgrst",         // PostgREST
  "42p01",         // PostgreSQL error codes
  "42703",
  "23505",
  "23503",
  "stack trace",
  "at /",
  "node_modules",
  ".ts:",
  ".js:",
  "internal server",
];

/**
 * API 에러 응답 생성 헬퍼
 *
 * 사용법:
 *   } catch (error) {
 *     console.error("작업 실패:", error);
 *     return apiError(error, "작업 처리 실패", 500);
 *   }
 */
export function apiError(error: unknown, fallback = "요청 처리 중 오류가 발생했습니다", status = 500): Response {
  return Response.json(
    { error: safeErrorMessage(error, fallback) },
    { status }
  );
}
