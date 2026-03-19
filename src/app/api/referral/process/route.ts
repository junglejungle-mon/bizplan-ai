/**
 * 추천 코드 처리 API
 * POST - 회원가입 완료 후 추천 보상 지급
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processReferralSignup } from "@/lib/referral";
import { validateBody, referralProcessSchema } from "@/lib/api/validation";

export async function POST(request: NextRequest) {
  try {
    // 인증 필수 — 로그인한 사용자만 추천 처리 가능
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const [processBody, processErr] = await validateBody(request, referralProcessSchema);
    if (processErr) return processErr;
    const { referralCode } = processBody;

    // newUserId는 인증된 사용자 ID 사용 (클라이언트 전달 금지)
    const result = await processReferralSignup({
      newUserId: user.id,
      referralCode,
    });

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[referral] 추천 처리 실패:", error);
    return NextResponse.json(
      { success: false, error: "추천 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
