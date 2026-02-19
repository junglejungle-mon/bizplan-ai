/**
 * DELETE /api/user/delete
 * 회원 탈퇴 (계정 삭제)
 * - 관련 데이터 cascade 삭제 (DB FK ON DELETE CASCADE 활용)
 * - Supabase Auth에서 사용자 삭제
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError } from "@/lib/api/error";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

export async function DELETE(request: Request) {
  try {
    // 계정 삭제 남용 방지
    const ip = getClientIP(request);
    const rl = await rateLimitAsync(`user-delete:${ip}`, RATE_LIMITS.AUTH);
    if (!rl.success) return rateLimitResponse(rl);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const adminSupabase = createAdminClient();

    // 1. 활성 구독이 있으면 만료 처리
    try {
      await adminSupabase
        .from("subscriptions")
        .update({
          status: "expired",
          canceled_at: new Date().toISOString(),
          metadata: { expired_reason: "account_deletion" },
        })
        .eq("user_id", user.id)
        .in("status", ["active", "trialing"]);
    } catch {
      // subscription table may not exist
    }

    // 2. 알림 설정 삭제
    await adminSupabase
      .from("notification_settings")
      .delete()
      .eq("user_id", user.id);

    // 3. 사용량 기록 삭제
    try {
      await adminSupabase
        .from("usage_records")
        .delete()
        .eq("user_id", user.id);
    } catch {
      // table may not exist
    }

    // 4. Supabase Auth에서 사용자 삭제 (cascade로 profiles, companies 등 자동 삭제)
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error("[user/delete] Auth 삭제 오류:", deleteError);
      return Response.json(
        { error: "계정 삭제에 실패했습니다. 고객센터에 문의해주세요." },
        { status: 500 }
      );
    }

    return Response.json({ success: true, message: "계정이 삭제되었습니다." });
  } catch (error) {
    console.error("[user/delete] 오류:", error);
    return apiError(error, "계정 삭제 실패", 500);
  }
}
