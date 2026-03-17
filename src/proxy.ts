import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { verifyAdminSession } from "@/lib/admin/auth";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── CSRF 방어: 상태 변경 API 요청에 Origin/Referer 검증 ───
  if (
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/cron/") && // cron은 서버→서버 호출
    ["POST", "PUT", "PATCH", "DELETE"].includes(request.method)
  ) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host") || "";

    // PortOne webhook은 외부 서버에서 옴
    const isWebhook = pathname.includes("/webhook");

    if (!isWebhook) {
      const allowedOrigins = [
        `https://${host}`,
        `http://${host}`,
        // 개발 환경
        "http://localhost:3000",
        "http://localhost:3002",
      ];

      const originValid = origin
        ? allowedOrigins.some((allowed) => origin.startsWith(allowed))
        : false;
      const refererValid = referer
        ? allowedOrigins.some((allowed) => referer.startsWith(allowed))
        : false;

      // Origin도 Referer도 없거나 둘 다 유효하지 않으면 차단
      if (!origin && !referer) {
        return NextResponse.json(
          { error: "CSRF validation failed" },
          { status: 403 }
        );
      } else if (!originValid && !refererValid) {
        return NextResponse.json(
          { error: "CSRF validation failed" },
          { status: 403 }
        );
      }
    }
  }

  // /admin/* 보호 (/admin/login 제외)
  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      return NextResponse.redirect(url);
    }
  }

  // /api/admin/* 보호 (/api/admin/auth 제외)
  if (pathname.startsWith("/api/admin") && !pathname.startsWith("/api/admin/auth")) {
    const isAdmin = await verifyAdminSession(request);
    if (!isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
