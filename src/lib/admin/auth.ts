/**
 * 관리자 인증 유틸리티 — Edge Runtime 호환
 * 미들웨어에서 사용되므로 Node.js crypto 사용 불가
 * 토큰 형식: admin:{expiry}:{signature(hex)}
 */

import { type NextRequest } from "next/server";

export const COOKIE_NAME = "admin_session";
const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24시간

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || "default-admin-password-change-me";
}

/**
 * Web Crypto API를 사용한 HMAC-SHA256
 */
async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const msgData = encoder.encode(message);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, msgData);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 상수 시간 비교 (타이밍 공격 방지)
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * HMAC 기반 토큰 생성
 */
export async function createAdminToken(): Promise<string> {
  const expiry = Date.now() + TOKEN_EXPIRY;
  const payload = `admin:${expiry}`;
  const signature = await hmacSha256(getSecret(), payload);
  return `${payload}:${signature}`;
}

/**
 * HMAC 토큰 검증
 */
export async function verifyAdminToken(token: string): Promise<boolean> {
  try {
    const parts = token.split(":");
    if (parts.length !== 3) return false;

    const [prefix, expiryStr, signature] = parts;
    const payload = `${prefix}:${expiryStr}`;

    // 만료 확인
    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) return false;

    // 서명 확인
    const expectedSig = await hmacSha256(getSecret(), payload);
    return constantTimeEqual(signature, expectedSig);
  } catch {
    return false;
  }
}

/**
 * 비밀번호 검증
 */
export function verifyPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  return constantTimeEqual(password, expected);
}

/**
 * 요청에서 관리자 세션 확인
 */
export async function verifyAdminSession(request: NextRequest): Promise<boolean> {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie?.value) return false;
  return verifyAdminToken(cookie.value);
}
