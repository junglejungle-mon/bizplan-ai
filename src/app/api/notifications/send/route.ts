import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendKakaoNotification } from "@/lib/notification/notification-service";
import { validateBody, sendNotificationSchema } from "@/lib/api/validation";

/**
 * POST /api/notifications/send
 * 테스트용 알림 발송 API
 * body: { type: "matching" | "deadline" | "plan_complete", variables: Record<string, string> }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  try {
    const [notifBody, notifErr] = await validateBody(request, sendNotificationSchema);
    if (notifErr) return notifErr;
    const { type, variables } = notifBody;

    const result = await sendKakaoNotification({
      userId: user.id,
      type,
      variables: variables || {},
    });

    return Response.json({
      success: result.sent,
      reason: result.reason,
    });
  } catch (error) {
    console.error("[Notifications] Send error:", error);
    return Response.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
