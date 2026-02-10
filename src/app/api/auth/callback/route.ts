import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/onboarding";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // 회사 정보가 있는지 확인
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // 카카오 로그인 시 전화번호를 profiles에 저장
        const provider = user.app_metadata?.provider;
        if (provider === "kakao") {
          const phone = user.user_metadata?.phone_number;
          const kakaoId = user.user_metadata?.provider_id || user.user_metadata?.sub;

          if (phone || kakaoId) {
            const admin = createAdminClient();
            await admin
              .from("profiles")
              .update({
                ...(phone ? { phone, phone_verified: true } : {}),
                ...(kakaoId ? { kakao_id: kakaoId } : {}),
              })
              .eq("id", user.id);
          }
        }

        const { data: companies } = await supabase
          .from("companies")
          .select("id")
          .eq("user_id", user.id)
          .limit(1);

        // 회사 정보가 있으면 대시보드, 없으면 온보딩
        const redirectTo = companies && companies.length > 0 ? "/dashboard" : "/onboarding";
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
