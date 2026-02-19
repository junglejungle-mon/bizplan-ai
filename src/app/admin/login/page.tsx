"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdminLoginPage() {
  const [step, setStep] = useState<"login" | "verify">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Step 1: Supabase 로그인
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError("이메일 또는 비밀번호가 올바르지 않습니다.");
        setLoading(false);
        return;
      }

      // 프로필에서 role 확인
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("사용자 정보를 불러올 수 없습니다.");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (!profile || profile.role !== "admin") {
        await supabase.auth.signOut();
        setError("관리자 권한이 없는 계정입니다.");
        setLoading(false);
        return;
      }

      // admin role 확인됨 → Step 2로 이동
      setStep("verify");
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: 관리자 비밀번호 확인
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });

      if (res.ok) {
        router.push("/admin/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "관리자 비밀번호가 올바르지 않습니다.");
      }
    } catch {
      setError("네트워크 오류");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs">
                BP
              </div>
              <span className="font-semibold text-gray-900">관리자</span>
            </div>
            <h1 className="text-xl font-semibold">
              {step === "login" ? "관리자 로그인" : "관리자 인증"}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {step === "login"
                ? "관리자 계정으로 로그인하세요"
                : "관리자 비밀번호를 입력하세요"}
            </p>
          </div>

          {step === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  이메일
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="admin@example.com"
                  required
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  비밀번호
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="계정 비밀번호"
                  required
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "로그인 중..." : "로그인"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                <p className="text-xs text-green-700">
                  <strong>{email}</strong> 계정으로 인증되었습니다.
                </p>
              </div>
              <div>
                <label
                  htmlFor="adminPassword"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  관리자 비밀번호
                </label>
                <input
                  id="adminPassword"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="관리자 비밀번호"
                  required
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "인증 중..." : "관리자 인증"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("login");
                  setEmail("");
                  setPassword("");
                  setAdminPassword("");
                  setError("");
                }}
                className="w-full text-sm text-gray-500 hover:text-gray-700"
              >
                다른 계정으로 로그인
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
