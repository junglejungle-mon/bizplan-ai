import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendKakaoNotification } from "@/lib/notification/notification-service";

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
    const body = await request.json();
    const { type, variables } = body;

    if (!type || !["matching", "deadline", "plan_complete"].includes(type)) {
      return Response.json(
        { error: "유효한 type이 필요합니다 (matching, deadline, plan_complete)" },
        { status: 400 }
      );
    }

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
    return Response.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}
