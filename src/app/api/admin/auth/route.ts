import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createAdminToken,
  COOKIE_NAME,
} from "@/lib/admin/auth";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, adminLoginSchema } from "@/lib/api/validation";
import { auditLog } from "@/lib/admin/audit";

/**
 * POST /api/admin/auth — 관리자 로그인
 */
export async function POST(request: NextRequest) {
  // Brute-force 방지: 분당 10회 제한
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`admin-auth:${ip}`, RATE_LIMITS.AUTH);
  if (!rl.success) return rateLimitResponse(rl);

  const [body, validationError] = await validateBody(request, adminLoginSchema);
  if (validationError) return validationError;

  const { password } = body;

  if (!verifyPassword(password)) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다" },
      { status: 401 }
    );
  }

  await auditLog({ action: "admin.login", ip });

  const token = await createAdminToken();
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60, // 24시간
    path: "/",
  });

  return response;
}

/**
 * DELETE /api/admin/auth — 로그아웃
 */
export async function DELETE(request: NextRequest) {
  await auditLog({ action: "admin.logout", ip: getClientIP(request) });
  const response = NextResponse.json({ success: true });

  response.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });

  return response;
}
