"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export function Header({ isLoggedIn = false }: { isLoggedIn?: boolean }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-sm">
            BP
          </div>
          <span className="text-xl font-bold text-gray-900">
            BizPlan <span className="text-blue-600">AI</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-1">
          {isLoggedIn ? (
            <>
              {[
                { href: "/dashboard", label: "대시보드" },
                { href: "/programs", label: "지원사업" },
                { href: "/plans", label: "사업계획서" },
                { href: "/documents", label: "서류관리" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-2 text-sm font-medium rounded-md transition-colors",
                    pathname.startsWith(item.href)
                      ? "text-blue-600 bg-blue-50"
                      : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                  )}
                >
                  {item.label}
                </Link>
              ))}
            </>
          ) : (
            <>
              <Link href="#features" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                기능 소개
              </Link>
              <Link href="#pricing" className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-900">
                요금제
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center space-x-3">
          {isLoggedIn ? (
            <form action="/api/auth/signout" method="post">
              <Button variant="ghost" size="sm">
                로그아웃
              </Button>
            </form>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  로그인
                </Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">무료로 시작하기</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
