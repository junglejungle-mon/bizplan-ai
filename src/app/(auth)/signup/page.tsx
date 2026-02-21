"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { trackSignUp } from "@/lib/analytics";
import { getStoredUTM, clearUTM } from "@/lib/utm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Gift, Check, X as XIcon } from "lucide-react";

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [referralValid, setReferralValid] = useState<boolean | null>(null);
  const [referralChecking, setReferralChecking] = useState(false);

  // URL 파라미터에서 추천 코드 자동 입력
  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) {
      setReferralCode(ref.toUpperCase());
      validateReferralCode(ref.toUpperCase());
    }
  }, [searchParams]);

  // 추천 코드 검증
  const validateReferralCode = async (code: string) => {
    if (!code || code.length < 4) {
      setReferralValid(null);
      return;
    }
    setReferralChecking(true);
    try {
      const res = await fetch("/api/referral/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      setReferralValid(data.valid);
    } catch {
      setReferralValid(null);
    } finally {
      setReferralChecking(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!agreeTerms || !agreePrivacy) {
      setError("이용약관과 개인정보처리방침에 동의해주세요.");
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 6자 이상이어야 합니다.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const utmData = getStoredUTM();
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          ...(utmData && {
            utm_source: utmData.utm_source,
            utm_medium: utmData.utm_medium,
            utm_campaign: utmData.utm_campaign,
            referrer: utmData.referrer,
          }),
        },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // 약관 동의 기록 DB 저장
    if (signUpData.user) {
      await supabase
        .from("profiles")
        .update({
          agreed_terms_at: new Date().toISOString(),
          agreed_privacy_at: new Date().toISOString(),
          terms_version: "2026-02-13",
          privacy_version: "2026-02-13",
        })
        .eq("id", signUpData.user.id);

      // 추천 코드 처리 (유효한 경우)
      if (referralCode && referralValid) {
        try {
          await fetch("/api/referral/process", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              newUserId: signUpData.user.id,
              referralCode,
            }),
          });
        } catch {
          // 추천 처리 실패해도 가입은 완료
        }
      }
    }

    trackSignUp("email");
    clearUTM();
    setSuccess(true);
    setLoading(false);
  };

  const handleGoogleSignup = async () => {
    if (!agreeTerms || !agreePrivacy) {
      setError("이용약관과 개인정보처리방침에 동의해주세요.");
      return;
    }
    trackSignUp("google");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });
  };

  const handleKakaoSignup = async () => {
    if (!agreeTerms || !agreePrivacy) {
      setError("이용약관과 개인정보처리방침에 동의해주세요.");
      return;
    }
    trackSignUp("kakao");
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`,
        scopes: "profile_nickname account_email phone_number",
      },
    });
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>이메일을 확인해주세요</CardTitle>
            <CardDescription>
              {email}로 확인 메일을 보냈습니다.
              <br />
              메일의 링크를 클릭하면 가입이 완료됩니다.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/login">
              <Button variant="outline">로그인 페이지로</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="mx-auto flex items-center space-x-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white font-bold">
              BP
            </div>
            <span className="text-2xl font-bold">
              BizPlan <span className="text-blue-600">AI</span>
            </span>
          </Link>
          <CardTitle>회원가입</CardTitle>
          <CardDescription>무료로 시작하고 AI로 사업계획서를 작성하세요</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              id="name"
              label="이름"
              placeholder="홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <Input
              id="email"
              type="email"
              label="이메일"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Input
              id="password"
              type="password"
              label="비밀번호"
              placeholder="6자 이상"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
            {/* 추천 코드 (선택) */}
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Gift className="h-3.5 w-3.5 text-purple-500" />
                <label htmlFor="referral" className="text-sm font-medium text-gray-700">
                  추천 코드 <span className="text-gray-400 font-normal">(선택)</span>
                </label>
              </div>
              <div className="relative">
                <Input
                  id="referral"
                  placeholder="추천 코드 입력"
                  value={referralCode}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    setReferralCode(val);
                    if (val.length >= 6) validateReferralCode(val);
                    else setReferralValid(null);
                  }}
                  maxLength={6}
                  className="pr-10 font-mono tracking-widest"
                />
                {referralChecking && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  </div>
                )}
                {!referralChecking && referralValid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Check className="h-4 w-4 text-green-500" />
                  </div>
                )}
                {!referralChecking && referralValid === false && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <XIcon className="h-4 w-4 text-red-400" />
                  </div>
                )}
              </div>
              {referralValid === true && (
                <p className="mt-1 text-xs text-green-600">
                  ✨ 가입 시 사업계획서 1건 무료 크레딧을 받습니다!
                </p>
              )}
              {referralValid === false && referralCode.length >= 4 && (
                <p className="mt-1 text-xs text-red-500">
                  유효하지 않은 추천 코드입니다
                </p>
              )}
            </div>

            {/* 약관 동의 */}
            <div className="space-y-2 pt-2">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={agreeTerms && agreePrivacy}
                  onChange={(e) => {
                    setAgreeTerms(e.target.checked);
                    setAgreePrivacy(e.target.checked);
                  }}
                  aria-label="전체 약관 동의"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">
                  전체 동의
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  aria-label="이용약관 동의"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">
                  <Link href="/terms" target="_blank" className="text-blue-600 hover:underline">[필수] 이용약관</Link>에 동의합니다
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer ml-6">
                <input
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                  aria-label="개인정보처리방침 동의"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-500">
                  <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline">[필수] 개인정보처리방침</Link>에 동의합니다
                </span>
              </label>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || !agreeTerms || !agreePrivacy}>
              {loading ? "가입 중..." : "회원가입"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">또는</span>
            </div>
          </div>

          <div className="space-y-2">
            <Button variant="outline" className="w-full gap-2" onClick={handleGoogleSignup} aria-label="Google 계정으로 회원가입">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Google로 회원가입
            </Button>

            <Button
              variant="outline"
              className="w-full gap-2 bg-[#FEE500] text-[#191919] hover:bg-[#FDD800] border-[#FEE500]"
              onClick={handleKakaoSignup}
              aria-label="카카오 계정으로 회원가입"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.38 6.24l-1.12 4.1c-.1.36.3.65.62.45l4.85-3.22c.42.04.84.07 1.27.07 5.52 0 10-3.36 10-7.64C22 6.36 17.52 3 12 3z"
                />
              </svg>
              카카오로 회원가입
            </Button>
          </div>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-gray-500">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">
              로그인
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
