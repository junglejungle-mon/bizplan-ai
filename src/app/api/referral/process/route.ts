/**
 * 추천 코드 처리 API
 * POST - 회원가입 완료 후 추천 보상 지급
 */

import { NextRequest, NextResponse } from "next/server";
import { processReferralSignup } from "@/lib/referral";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { newUserId, referralCode } = body;

    if (!newUserId || !referralCode) {
      return NextResponse.json(
        { success: false, error: "필수 파라미터가 누락되었습니다" },
        { status: 400 }
      );
    }

    const result = await processReferralSignup({
      newUserId,
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
