"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  Mail,
  MessageSquare,
  LogOut,
  Loader2,
  Check,
  Phone,
  Send,
  User,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { SubscriptionStatus } from "@/components/payment/SubscriptionStatus";
import { PaymentHistory } from "@/components/payment/PaymentHistory";

interface NotificationSettings {
  kakao: {
    enabled: boolean;
    notify_matching: boolean;
    notify_deadline: boolean;
    notify_plan_complete: boolean;
  };
  email: {
    enabled: boolean;
    notify_matching: boolean;
    notify_deadline: boolean;
    notify_plan_complete: boolean;
  };
}

const DEFAULT_SETTINGS: NotificationSettings = {
  kakao: {
    enabled: false,
    notify_matching: true,
    notify_deadline: true,
    notify_plan_complete: true,
  },
  email: {
    enabled: true,
    notify_matching: true,
    notify_deadline: true,
    notify_plan_complete: true,
  },
};

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] =
    useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [phone, setPhone] = useState("");
  const [phoneSaving, setPhoneSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const router = useRouter();

  const showSaved = useCallback(() => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, []);

  useEffect(() => {
    const loadData = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setUser(user);

      // 프로필 로드
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      setProfile(profileData);
      if (profileData?.phone) {
        setPhone(profileData.phone);
      }
      if (profileData?.name) {
        setName(profileData.name);
      }

      // 알림 설정 로드 (DB)
      const { data: settingsData } = await supabase
        .from("notification_settings")
        .select("*")
        .eq("user_id", user.id);

      if (settingsData && settingsData.length > 0) {
        const newSettings = { ...DEFAULT_SETTINGS };
        for (const s of settingsData) {
          const ch = s.channel as string;
          if (ch === "kakao" || ch === "email") {
            newSettings[ch] = {
              enabled: s.enabled,
              notify_matching: s.notify_matching,
              notify_deadline: s.notify_deadline,
              notify_plan_complete: s.notify_plan_complete,
            };
          }
        }
        setNotifications(newSettings);
      }

      setLoading(false);
    };
    loadData();
  }, [router]);

  const saveName = async () => {
    if (!user || !name.trim()) return;
    setNameSaving(true);

    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ name: name.trim() })
      .eq("id", user.id);

    setProfile((prev: any) => (prev ? { ...prev, name: name.trim() } : prev));
    setNameSaving(false);
    showSaved();
    toast.success("이름이 변경되었습니다.");
  };

  const changePassword = async () => {
    setPasswordError("");

    if (newPassword.length < 6) {
      setPasswordError("새 비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("비밀번호가 일치하지 않습니다.");
      return;
    }

    setPasswordSaving(true);

    const supabase = createClient();

    // 현재 비밀번호로 재인증
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword,
    });

    if (signInError) {
      setPasswordError("현재 비밀번호가 올바르지 않습니다.");
      setPasswordSaving(false);
      return;
    }

    // 비밀번호 변경
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setPasswordError("비밀번호 변경에 실패했습니다.");
      setPasswordSaving(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordSaving(false);
    toast.success("비밀번호가 변경되었습니다.");
  };

  const savePhone = async () => {
    if (!user || !phone.trim()) return;
    setPhoneSaving(true);

    const supabase = createClient();
    const cleaned = phone.replace(/[^0-9]/g, "");
    await supabase
      .from("profiles")
      .update({ phone: cleaned })
      .eq("id", user.id);

    setPhone(cleaned);
    setProfile((prev: any) => (prev ? { ...prev, phone: cleaned } : prev));
    setPhoneSaving(false);
    showSaved();
  };

  const toggleChannel = async (channel: "kakao" | "email") => {
    if (!user) return;

    // 카카오 알림 활성화 시 전화번호 필수
    if (channel === "kakao" && !notifications.kakao.enabled && !profile?.phone) {
      toast.warning("카카오 알림톡을 받으려면 먼저 전화번호를 등록해주세요.");
      return;
    }

    const updated = {
      ...notifications,
      [channel]: {
        ...notifications[channel],
        enabled: !notifications[channel].enabled,
      },
    };
    setNotifications(updated);

    const supabase = createClient();
    await supabase.from("notification_settings").upsert(
      {
        user_id: user.id,
        channel,
        ...updated[channel],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,channel" }
    );
    showSaved();
  };

  const toggleNotificationType = async (
    channel: "kakao" | "email",
    type: "notify_matching" | "notify_deadline" | "notify_plan_complete"
  ) => {
    if (!user) return;

    const updated = {
      ...notifications,
      [channel]: {
        ...notifications[channel],
        [type]: !notifications[channel][type],
      },
    };
    setNotifications(updated);

    const supabase = createClient();
    await supabase.from("notification_settings").upsert(
      {
        user_id: user.id,
        channel,
        ...updated[channel],
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,channel" }
    );
    showSaved();
  };

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

  const Toggle = ({
    enabled,
    onClick,
  }: {
    enabled: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? "bg-blue-600" : "bg-gray-200"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">설정</h1>
          <p className="text-gray-500">알림 및 계정 설정</p>
        </div>
        {saved && (
          <div className="flex items-center gap-1 text-green-600 text-sm">
            <Check className="h-4 w-4" /> 저장됨
          </div>
        )}
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
            <span className="text-sm text-gray-600">로그인 방법</span>
            <Badge variant="secondary">
              {user?.app_metadata?.provider === "kakao"
                ? "카카오"
                : user?.app_metadata?.provider === "google"
                  ? "Google"
                  : "이메일"}
            </Badge>
          </div>
          {/* 플랜 정보는 SubscriptionStatus에서 표시 */}
        </CardContent>
      </Card>

      {/* 프로필 수정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5 text-blue-600" />
            프로필 수정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">
              이름
            </label>
            <div className="flex gap-2">
              <Input
                id="name"
                placeholder="이름을 입력하세요"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="flex-1"
              />
              <Button
                size="sm"
                onClick={saveName}
                disabled={nameSaving || !name.trim() || name.trim() === profile?.name}
              >
                {nameSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "저장"
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 비밀번호 변경 (이메일 로그인 사용자만) */}
      {user?.app_metadata?.provider === "email" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-5 w-5 text-blue-600" />
              비밀번호 변경
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              id="currentPassword"
              type="password"
              label="현재 비밀번호"
              placeholder="현재 비밀번호 입력"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <Input
              id="newPassword"
              type="password"
              label="새 비밀번호"
              placeholder="최소 6자 이상"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirmPassword"
              type="password"
              label="새 비밀번호 확인"
              placeholder="새 비밀번호 다시 입력"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {passwordError && (
              <p className="text-sm text-red-500">{passwordError}</p>
            )}
            <Button
              onClick={changePassword}
              disabled={passwordSaving || !currentPassword || !newPassword || !confirmPassword}
              className="w-full"
            >
              {passwordSaving ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> 변경 중...
                </span>
              ) : (
                "비밀번호 변경"
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* 전화번호 등록 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-600" />
            전화번호
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-500 mb-3">
            카카오 알림톡을 받으려면 전화번호를 등록해주세요.
          </p>
          <div className="flex gap-2">
            <Input
              id="phone"
              type="tel"
              placeholder="01012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={savePhone}
              disabled={phoneSaving || !phone.trim()}
            >
              {phoneSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "저장"
              )}
            </Button>
          </div>
          {profile?.phone && (
            <p className="text-xs text-green-600 mt-2">
              {profile.phone_verified
                ? "카카오 인증된 번호입니다"
                : "등록된 번호: " + profile.phone}
            </p>
          )}
        </CardContent>
      </Card>

      {/* 카카오 알림톡 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-5 w-5 text-[#FEE500]" />
            카카오 알림톡
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">알림톡 수신</p>
              <p className="text-xs text-gray-500">
                카카오톡으로 주요 알림을 받습니다
              </p>
            </div>
            <Toggle
              enabled={notifications.kakao.enabled}
              onClick={() => toggleChannel("kakao")}
            />
          </div>

          {notifications.kakao.enabled && (
            <div className="ml-4 space-y-3 border-l-2 border-gray-100 pl-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">매칭 결과 알림</p>
                  <p className="text-xs text-gray-400">
                    새로운 매칭 공고 발견 시
                  </p>
                </div>
                <Toggle
                  enabled={notifications.kakao.notify_matching}
                  onClick={() =>
                    toggleNotificationType("kakao", "notify_matching")
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">마감 임박 알림</p>
                  <p className="text-xs text-gray-400">
                    매칭 공고 마감 D-3, D-1
                  </p>
                </div>
                <Toggle
                  enabled={notifications.kakao.notify_deadline}
                  onClick={() =>
                    toggleNotificationType("kakao", "notify_deadline")
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">사업계획서 완료</p>
                  <p className="text-xs text-gray-400">
                    AI 사업계획서 생성 완료 시
                  </p>
                </div>
                <Toggle
                  enabled={notifications.kakao.notify_plan_complete}
                  onClick={() =>
                    toggleNotificationType("kakao", "notify_plan_complete")
                  }
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 이메일 알림 설정 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-600" />
            알림 설정
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">이메일 알림</p>
                <p className="text-xs text-gray-500">
                  새 매칭 공고, 마감 임박 알림
                </p>
              </div>
            </div>
            <Toggle
              enabled={notifications.email.enabled}
              onClick={() => toggleChannel("email")}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  Discord 알림
                </p>
                <p className="text-xs text-gray-500">
                  실시간 공고 알림 (준비 중)
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="text-xs">
              준비 중
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* 구독 관리 */}
      <SubscriptionStatus />

      {/* 결제 내역 */}
      <PaymentHistory />

      {/* 로그아웃 & 회원탈퇴 */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Button
            variant="outline"
            className="w-full gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" /> 로그아웃
          </Button>
          <Button
            variant="ghost"
            className="w-full text-xs text-gray-400 hover:text-red-500"
            onClick={async () => {
              const confirmed = window.confirm(
                "정말 탈퇴하시겠습니까?\n\n" +
                "- 모든 사업계획서, 기업 정보, 결제 내역이 삭제됩니다.\n" +
                "- 유료 구독이 있는 경우 즉시 해지됩니다.\n" +
                "- 이 작업은 되돌릴 수 없습니다."
              );
              if (!confirmed) return;

              const doubleConfirm = window.confirm(
                "마지막 확인입니다.\n삭제된 데이터는 복구할 수 없습니다.\n정말 탈퇴하시겠습니까?"
              );
              if (!doubleConfirm) return;

              try {
                const res = await fetch("/api/user/delete", { method: "DELETE" });
                if (!res.ok) {
                  const data = await res.json();
                  toast.error(data.error || "탈퇴 처리에 실패했습니다.");
                  return;
                }
                toast.success("탈퇴가 완료되었습니다. 그동안 이용해주셔서 감사합니다.");
                window.location.href = "/";
              } catch {
                toast.error("오류가 발생했습니다. 고객센터에 문의해주세요.");
              }
            }}
          >
            회원 탈퇴
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
