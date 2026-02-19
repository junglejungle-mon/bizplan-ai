/**
 * GET /api/admin/payments
 * 관리자: 전체 결제 목록 조회 (사용자 정보 포함)
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
    const search = searchParams.get("search") || undefined;
    const offset = (page - 1) * limit;

    let query = supabase
      .from("payments")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("status", status);
    }

    const { data: payments, error, count } = await query;

    if (error) {
      console.error("[admin/payments] DB 오류:", error.message);
      throw new Error("결제 목록 조회 실패");
    }

    // 사용자 정보 enrichment
    const userIds = [...new Set((payments || []).map((p) => p.user_id))];
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

    // 검색 필터 (이름/이메일)
    let enriched = (payments || []).map((p) => ({
      ...p,
      user_name: profileMap[p.user_id]?.name || null,
      user_email: profileMap[p.user_id]?.email || null,
    }));

    if (search) {
      const s = search.toLowerCase();
      enriched = enriched.filter(
        (p) =>
          (p.user_name && p.user_name.toLowerCase().includes(s)) ||
          (p.user_email && p.user_email.toLowerCase().includes(s)) ||
          (p.portone_payment_id && p.portone_payment_id.toLowerCase().includes(s))
      );
    }

    return Response.json({
      payments: enriched,
      total: search ? enriched.length : (count || 0),
      page,
      limit,
      totalPages: Math.ceil((search ? enriched.length : (count || 0)) / limit),
    });
  } catch (error) {
    console.error("[admin/payments] 오류:", error);
    return apiError(error, "결제 목록 조회 실패", 500);
  }
}
