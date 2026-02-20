"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "대시보드" },
  { href: "/admin/companies", label: "업체" },
  { href: "/admin/matchings", label: "매칭" },
  { href: "/admin/plans", label: "계획서" },
  { href: "/admin/ir", label: "IR" },
  { href: "/admin/programs", label: "프로그램" },
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/quality", label: "품질/RAG" },
  { href: "/admin/agents", label: "에이전트" },
  { href: "/admin/payments", label: "결제" },
  { href: "/admin/segments", label: "세그먼트" },
  { href: "/admin/cs", label: "CS" },
  { href: "/admin/system", label: "시스템" },
  { href: "/admin/api-docs", label: "API" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // 세션 만료 주기적 체크 (5분마다)
  useEffect(() => {
    if (pathname === "/admin/login") return;

    const checkSession = async () => {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000);
        const res = await fetch("/api/admin/dashboard/stats", {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.status === 401) {
          router.push("/admin/login");
        }
      } catch {
        // 네트워크 오류 또는 abort는 무시
      }
    };

    const interval = setInterval(checkSession, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-6 justify-between">
        <div className="flex items-center gap-6">
          <Link href="/admin/dashboard" className="font-semibold text-gray-900">
            BizPlan AI 관리자
          </Link>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm px-3 py-1.5 rounded-md transition-colors ${
                  pathname.startsWith(item.href)
                    ? "text-blue-600 font-medium bg-blue-50"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            서비스로
          </Link>
          <button
            onClick={async () => {
              await fetch("/api/admin/auth", { method: "DELETE" });
              window.location.href = "/admin/login";
            }}
            className="text-sm text-red-500 hover:text-red-700"
          >
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
