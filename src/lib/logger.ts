/**
 * 구조화 로깅 모듈 (Pino 기반)
 *
 * 사용법:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ planId, userId }, "사업계획서 생성 시작");
 *   logger.error({ err, planId }, "생성 실패");
 *
 * 자식 로거:
 *   const log = logger.child({ module: "matching" });
 *   log.info("매칭 시작");
 */
import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  // 개발: 사람이 읽기 쉬운 포맷, 프로덕션: JSON
  ...(isDev
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        },
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
      }
    : {
        formatters: {
          level(label: string) {
            return { level: label };
          },
        },
      }),
  // 기본 메타데이터
  base: {
    service: "bizplan-ai",
    env: process.env.NODE_ENV || "development",
  },
  // 타임스탬프 ISO 형식
  timestamp: pino.stdTimeFunctions.isoTime,
});

// 모듈별 자식 로거 팩토리
export function createLogger(module: string) {
  return logger.child({ module });
}

// 자주 쓰는 모듈 로거
export const apiLogger = createLogger("api");
export const adminLogger = createLogger("admin");
export const aiLogger = createLogger("ai");
export const matchingLogger = createLogger("matching");
export const qualityLogger = createLogger("quality");
export const exportLogger = createLogger("export");
