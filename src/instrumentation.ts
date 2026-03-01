export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }

  // 필수 환경변수 검증 (서버 부팅 시 1회)
  validateRequiredEnvVars();
}

/**
 * 필수 환경변수 존재 여부를 검증합니다.
 * 누락 시 경고를 출력하고, CRITICAL 레벨은 프로세스를 종료합니다.
 */
function validateRequiredEnvVars() {
  // CRITICAL: 이것 없으면 앱이 전혀 동작할 수 없음
  const critical = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "ADMIN_PASSWORD",
  ];

  // IMPORTANT: 핵심 기능에 필요하지만 앱 전체가 죽진 않음
  const important = [
    "CRON_SECRET",
  ];

  // OPTIONAL: 특정 기능에만 필요 (없으면 해당 기능 비활성)
  const optional = [
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "PORTONE_API_SECRET",
    "PORTONE_WEBHOOK_SECRET",
    "REDIS_URL",
    "SOLAPI_API_KEY",
    "SOLAPI_API_SECRET",
    "NOTION_API_KEY",
    "PERPLEXITY_API_KEY",
    "BIZINFO_CRTFC_KEY",
    "DATA_GO_KR_SERVICE_KEY",
  ];

  const missingCritical: string[] = [];
  const missingImportant: string[] = [];
  const missingOptional: string[] = [];

  for (const key of critical) {
    if (!process.env[key]) missingCritical.push(key);
  }
  for (const key of important) {
    if (!process.env[key]) missingImportant.push(key);
  }
  for (const key of optional) {
    if (!process.env[key]) missingOptional.push(key);
  }

  if (missingCritical.length > 0) {
    console.error(
      `\n🚨 [ENV] CRITICAL 환경변수 누락! 서버를 시작할 수 없습니다:\n` +
      missingCritical.map((k) => `   - ${k}`).join("\n") +
      "\n"
    );
    // 프로덕션에서만 에러 throw (개발 중에는 경고만)
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        `CRITICAL 환경변수 누락: ${missingCritical.join(", ")}`
      );
    }
  }

  if (missingImportant.length > 0) {
    console.warn(
      `\n⚠️  [ENV] IMPORTANT 환경변수 누락 (일부 기능 제한):\n` +
      missingImportant.map((k) => `   - ${k}`).join("\n") +
      "\n"
    );
  }

  if (missingOptional.length > 0 && process.env.NODE_ENV !== "production") {
    console.info(
      `ℹ️  [ENV] Optional 환경변수 미설정 (해당 기능 비활성):\n` +
      missingOptional.map((k) => `   - ${k}`).join("\n")
    );
  }
}

export const onRequestError = async (...args: unknown[]) => {
  const { captureRequestError } = await import("@sentry/nextjs");
  return (captureRequestError as (...a: unknown[]) => void)(...args);
};
