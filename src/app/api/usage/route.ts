/**
 * GET /api/usage
 * 이번 달 사용량 조회
 */

import { createClient } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/payment/usage";
import { apiError } from "@/lib/api/error";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await getUsageSummary(user.id);
    return Response.json(summary);
  } catch (error) {
    console.error("[usage] 조회 오류:", error);
    return apiError(error, "사용량 조회 실패", 500);
  }
}
