"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  Search,
  FileText,
  FolderOpen,
  Building2,
  Settings,
  Presentation,
} from "lucide-react";

const sidebarItems = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard },
  { href: "/programs", label: "지원사업", icon: Search },
  { href: "/plans", label: "사업계획서", icon: FileText },
  { href: "/documents", label: "서류관리", icon: FolderOpen },
  { href: "/company", label: "회사 정보", icon: Building2 },
  { href: "/settings", label: "설정", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const [profileScore, setProfileScore] = useState<number>(0);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: company } = await supabase
          .from("companies")
          .select("profile_score")
          .eq("user_id", user.id)
          .limit(1)
          .single();

        if (company) {
          setProfileScore(company.profile_score || 0);
        }
      } catch (e) {
        // 로그인 안 된 경우 무시
      }
    }
    fetchProfile();
  }, []);

  const scoreLabel = profileScore >= 70
    ? "고도화 완료!"
    : profileScore >= 30
      ? "인터뷰로 고도화하세요"
      : "기본 정보를 입력하세요";

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:border-r lg:border-gray-200 lg:bg-white lg:pt-16">
      <nav className="flex flex-1 flex-col px-3 py-4 space-y-1">
        {sidebarItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive ? "text-blue-600" : "text-gray-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-gray-200 p-4">
        <Link href="/company" className="block rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-3 hover:from-blue-100 hover:to-indigo-100 transition-colors">
          <p className="text-xs font-medium text-blue-800">프로필 완성도</p>
          <div className="mt-2 h-2 rounded-full bg-blue-100">
            <div
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                profileScore >= 70 ? "bg-green-500" : profileScore >= 30 ? "bg-blue-600" : "bg-orange-500"
              )}
              style={{ width: `${profileScore}%` }}
            />
          </div>
          <p className={cn(
            "mt-1 text-xs",
            profileScore >= 70 ? "text-green-600" : profileScore >= 30 ? "text-blue-600" : "text-orange-600"
          )}>
            {profileScore}% — {scoreLabel}
          </p>
        </Link>
      </div>
    </aside>
  );
}
