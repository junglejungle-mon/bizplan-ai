"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
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
        <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-3">
          <p className="text-xs font-medium text-blue-800">프로필 완성도</p>
          <div className="mt-2 h-2 rounded-full bg-blue-100">
            <div className="h-2 rounded-full bg-blue-600" style={{ width: "30%" }} />
          </div>
          <p className="mt-1 text-xs text-blue-600">30% — 인터뷰로 고도화하세요</p>
        </div>
      </div>
    </aside>
  );
}
