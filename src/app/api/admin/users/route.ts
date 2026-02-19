/**
 * GET /api/admin/users
 * 관리자: 사용자 목록 조회 (배치 조회로 N+1 문제 해결)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const rawSearch = searchParams.get("search");
    const search = rawSearch ? rawSearch.slice(0, 100) : null; // 검색어 길이 제한
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100); // 최대 100
    const sort = searchParams.get("sort") || "created_at";
    const order = searchParams.get("order") || "desc";

    // 1. 사용자 목록 조회
    let query = supabase
      .from("profiles")
      .select("id, name, email, created_at", { count: "exact" });

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const from = (page - 1) * limit;
    query = query
      .order(sort, { ascending: order === "asc" })
      .range(from, from + limit - 1);

    const { data: users, count, error } = await query;

    if (error) {
      return apiError(error, "사용자 목록 조회 실패", 500);
    }

    const userList = users || [];
    const userIds = userList.map((u) => u.id);

    if (userIds.length === 0) {
      return Response.json({ users: [], total: 0, page, limit });
    }

    // 2. 배치 조회: companies (1 쿼리)
    const { data: companies } = await supabase
      .from("companies")
      .select("id, user_id, name, industry, profile_score")
      .in("user_id", userIds);

    const companyMap: Record<
      string,
      { id: string; name: string; industry: string | null; profile_score: number | null }
    > = {};
    (companies || []).forEach((c) => {
      companyMap[c.user_id] = {
        id: c.id,
        name: c.name,
        industry: c.industry,
        profile_score: c.profile_score,
      };
    });

    // 3. 배치 조회: business_plans 수 (1 쿼리)
    const companyIds = Object.values(companyMap).map((c) => c.id);
    const planCountMap: Record<string, number> = {};

    if (companyIds.length > 0) {
      const { data: plans } = await supabase
        .from("business_plans")
        .select("company_id")
        .in("company_id", companyIds);

      if (plans) {
        for (const p of plans) {
          planCountMap[p.company_id] = (planCountMap[p.company_id] || 0) + 1;
        }
      }
    }

    // 4. 배치 조회: subscriptions + plans (2 쿼리)
    let subscriptionMap: Record<
      string,
      {
        id: string;
        status: string;
        plan_id: string;
        current_period_end: string | null;
        cancel_at_period_end: boolean;
        plan: { name: string; display_name: string; price: number } | null;
      }
    > = {};

    try {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, user_id, status, plan_id, current_period_end, cancel_at_period_end")
        .in("user_id", userIds)
        .in("status", ["active", "trialing"]);

      if (subs && subs.length > 0) {
        const planIds = [...new Set(subs.map((s) => s.plan_id))];
        const { data: planData } = await supabase
          .from("subscription_plans")
          .select("id, name, display_name, price")
          .in("id", planIds);

        const planMap: Record<string, { name: string; display_name: string; price: number }> = {};
        (planData || []).forEach((p) => {
          planMap[p.id] = { name: p.name, display_name: p.display_name, price: p.price };
        });

        for (const sub of subs) {
          subscriptionMap[sub.user_id] = {
            id: sub.id,
            status: sub.status,
            plan_id: sub.plan_id,
            current_period_end: sub.current_period_end,
            cancel_at_period_end: sub.cancel_at_period_end,
            plan: planMap[sub.plan_id] || null,
          };
        }
      }
    } catch {
      // subscription tables may not exist yet
    }

    // 5. 조합 (메모리에서 매핑)
    const enriched = userList.map((user) => {
      const company = companyMap[user.id] || null;
      const companyId = company?.id;
      return {
        ...user,
        full_name: user.name,
        company: company ? { ...company, company_name: company.name } : null,
        planCount: companyId ? planCountMap[companyId] || 0 : 0,
        subscription: subscriptionMap[user.id] || null,
      };
    });

    return Response.json({
      users: enriched,
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error("Users list error:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}
