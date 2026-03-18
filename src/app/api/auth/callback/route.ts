import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTrialSubscription, getPlanByName } from "@/lib/payment/subscription";

// 허용된 내부 리다이렉트 경로 (오픈 리다이렉트 방지)
const ALLOWED_PATHS = ["/dashboard", "/onboarding", "/settings", "/pricing", "/plans"];

function sanitizeRedirectPath(path: string | null): string {
  if (!path) return "/onboarding";
  // 절대 URL이나 프로토콜 상대 경로 차단
  if (path.startsWith("//") || path.includes("://")) return "/onboarding";
  // 허용된 경로 중 하나로 시작해야 함
  if (!ALLOWED_PATHS.some((allowed) => path === allowed || path.startsWith(allowed + "/"))) {
    return "/onboarding";
  }
  return path;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = sanitizeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 회사 정보가 있는지 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const admin = createAdminClient();
        const provider = user.app_metadata?.provider;

        // 카카오 로그인 시 전화번호를 profiles에 저장
        if (provider === "kakao") {
          const phone = user.user_metadata?.phone_number;
          const kakaoId = user.user_metadata?.provider_id || user.user_metadata?.sub;

          if (phone || kakaoId) {
            await admin
              .from("profiles")
              .update({
                ...(phone ? { phone, phone_verified: true } : {}),
                ...(kakaoId ? { kakao_id: kakaoId } : {}),
              })
              .eq("id", user.id);
          }
        }

        // 약관 동의 여부 확인 (OAuth 사용자)
        const { data: profile } = await admin
          .from("profiles")
          .select("agreed_terms_at, agreed_privacy_at")
          .eq("id", user.id)
          .single();

        const needsTerms = !profile?.agreed_terms_at || !profile?.agreed_privacy_at;

        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);

        // 약관 미동의 → 온보딩에서 약관 동의 필수
        if (needsTerms) {
          return NextResponse.redirect(`${origin}/onboarding?require_terms=true`);
        }

        // 신규 가입자 자동 14일 Pro 체험 생성
        try {
          const { data: existingSub } = await admin
            .from("subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .limit(1);

          if (!existingSub || existingSub.length === 0) {
            const proPlan = await getPlanByName("pro");
            if (proPlan) {
              await createTrialSubscription({
                userId: user.id,
                planId: proPlan.id,
              });
            }
          }
        } catch {
          // trial 생성 실패해도 가입 플로우는 계속 진행
        }

        // 회사 정보가 있으면 대시보드, 없으면 온보딩
        const redirectTo = companies && companies.length > 0 ? "/dashboard" : "/onboarding";
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
