"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Mail, MessageSquare, LogOut, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const loadUser = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);
      setLoading(false);
    };
    loadUser();
  }, [router]);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-500">알림 및 계정 설정</p>
      </div>

      {/* 계정 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 정보</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">이메일</span>
            <span className="text-sm font-medium">{user?.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">가입일</span>
            <span className="text-sm font-medium">
              {user?.created_at
                ? new Date(user.created_at).toLocaleDateString("ko-KR")
                : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">플랜</span>
            <Badge variant="secondary">무료</Badge>
          </div>
        </CardContent>
      </Card>

      {/* 알림 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            알림 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              icon: Mail,
              label: "이메일 알림",
              desc: "새 매칭 공고, 마감 임박 알림",
              enabled: true,
            },
            {
              icon: MessageSquare,
              label: "Discord 알림",
              desc: "실시간 공고 알림 (Discord 채널 연동)",
              enabled: false,
            },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">
                    {item.label}
                  </p>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                {item.enabled ? "켜짐" : "꺼짐"}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 구독 관리 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">구독 관리</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 p-4">
            <h4 className="font-medium text-blue-900">
              프리미엄으로 업그레이드
            </h4>
            <p className="mt-1 text-sm text-blue-700">
              무제한 매칭 + 사업계획서 자동 작성 + AI 비서
            </p>
            <Button className="mt-3" size="sm">
              플랜 보기
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 로그아웃 */}
      <Card>
        <CardContent className="p-4">
          <Button
            variant="outline"
            className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> 로그아웃
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
