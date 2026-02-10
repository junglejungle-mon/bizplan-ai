import { NextRequest, NextResponse } from "next/server";
import {
  verifyPassword,
  createAdminToken,
  COOKIE_NAME,
} from "@/lib/admin/auth";

/**
 * POST /api/admin/auth — 관리자 로그인
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password } = body;

  if (!password || !verifyPassword(password)) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다" },
      { status: 401 }
    );
  }

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
export async function DELETE() {
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
