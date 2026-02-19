/**
 * GET /api/admin/subscriptions
 * 관리자: 전체 구독 목록 조회 (사용자 정보 포함)
 * (middleware.ts에서 관리자 인증 처리됨)
 */

import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

export async function GET(request: NextRequest) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const status = searchParams.get("status") || undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error("[admin/subscriptions] DB 오류:", error.message);
      throw new Error("구독 목록 조회 실패");
    }

    // 사용자 정보 enrichment
    const userIds = [...new Set((data || []).map((s) => s.user_id))];
    let profileMap: Record<string, { name: string | null; email: string }> = {};

    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      if (profiles) {
        profileMap = Object.fromEntries(
          profiles.map((p) => [p.id, { name: p.name, email: p.email }])
        );
      }
    }

    return Response.json({
      subscriptions: (data || []).map((sub) => ({
        id: sub.id,
        userId: sub.user_id,
        userName: profileMap[sub.user_id]?.name || null,
        userEmail: profileMap[sub.user_id]?.email || null,
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        canceledAt: sub.canceled_at,
        createdAt: sub.created_at,
        plan: sub.plan
          ? {
              id: sub.plan.id,
              name: sub.plan.name,
              displayName: sub.plan.display_name,
              price: sub.plan.price,
            }
          : null,
      })),
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error("[admin/subscriptions] 오류:", error);
    return apiError(error, "구독 목록 조회 실패", 500);
  }
}
