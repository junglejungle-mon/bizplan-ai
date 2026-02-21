/**
 * 추천 코드 검증 API
 * POST - 회원가입 시 추천 코드 유효성 확인
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { valid: false, error: "추천 코드를 입력해주세요" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data } = await supabase
      .from("referral_codes")
      .select("id, user_id, is_active")
      .eq("code", code.toUpperCase().trim())
      .single();

    if (!data || !data.is_active) {
      return NextResponse.json({
        valid: false,
        error: "유효하지 않은 추천 코드입니다",
      });
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error("[referral] 코드 검증 실패:", error);
    return NextResponse.json(
      { valid: false, error: "코드 검증 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
