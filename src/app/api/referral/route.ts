/**
 * 추천 시스템 API
 * GET  - 추천 대시보드 데이터 조회
 * POST - 공유 이벤트 로깅
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReferralDashboard, logShareEvent } from "@/lib/referral";
import { validateBody, referralShareSchema } from "@/lib/api/validation";

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const dashboard = await getReferralDashboard(user.id);
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error("[referral] 대시보드 조회 실패:", error);
    return NextResponse.json(
      { error: "추천 정보를 불러오는 데 실패했습니다" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const [shareBody, shareErr] = await validateBody(request, referralShareSchema);
    if (shareErr) return shareErr;
    const { shareType } = shareBody;

    await logShareEvent(user.id, shareType);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[referral] 공유 이벤트 기록 실패:", error);
    return NextResponse.json(
      { error: "공유 이벤트 기록에 실패했습니다" },
      { status: 500 }
    );
  }
}
