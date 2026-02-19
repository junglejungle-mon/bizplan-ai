/**
 * GET /api/admin/segments
 * 관리자: 고객 세그먼테이션
 * - 플랜별 분류
 * - 활동별 분류 (활발/보통/비활성)
 * - 가입 시기별
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

interface SegmentUser {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  plan: string | null;
  planCount: number;
  profileScore: number;
  lastActivity: string | null;
}

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();

    // 전체 사용자 조회
    const { data: profiles, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, email, created_at")
      .order("created_at", { ascending: false });

    if (profileError) throw new Error(profileError.message);

    const users = profiles || [];
    const userIds = users.map((u) => u.id);

    // 구독 정보 가져오기
    let subscriptionMap: Record<string, string> = {};
    try {
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("user_id, plan:subscription_plans(name, display_name)")
        .in("status", ["active", "trialing"]);

      if (subs) {
        for (const sub of subs) {
          const plan = sub.plan as unknown as { name: string; display_name: string } | null;
          subscriptionMap[sub.user_id] = plan?.display_name || plan?.name || "unknown";
        }
      }
    } catch { /* subscription tables may not exist */ }

    // 기업 정보 (프로필 점수)
    const { data: companies } = await supabase
      .from("companies")
      .select("user_id, profile_score")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const companyMap: Record<string, number> = {};
    (companies || []).forEach((c) => { companyMap[c.user_id] = c.profile_score || 0; });

    // 사업계획서 수 (company 기준)
    const { data: companyList } = await supabase
      .from("companies")
      .select("id, user_id")
      .in("user_id", userIds.length > 0 ? userIds : ["00000000-0000-0000-0000-000000000000"]);

    const companyIdMap: Record<string, string> = {};
    (companyList || []).forEach((c) => { companyIdMap[c.user_id] = c.id; });

    const companyIds = Object.values(companyIdMap);
    let planCountMap: Record<string, number> = {};
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

    // 세그먼트 분류
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    const segmentedUsers: SegmentUser[] = users.map((u) => {
      const companyId = companyIdMap[u.id];
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        created_at: u.created_at,
        plan: subscriptionMap[u.id] || "무료",
        planCount: companyId ? (planCountMap[companyId] || 0) : 0,
        profileScore: companyMap[u.id] || 0,
        lastActivity: u.created_at, // simplified
      };
    });

    // 세그먼트 집계
    const segments = {
      // 플랜별
      byPlan: {
        free: segmentedUsers.filter((u) => u.plan === "무료"),
        starter: segmentedUsers.filter((u) => u.plan === "스타터"),
        pro: segmentedUsers.filter((u) => u.plan === "프로"),
        enterprise: segmentedUsers.filter((u) => u.plan === "엔터프라이즈"),
      },
      // 활동별
      byActivity: {
        active: segmentedUsers.filter((u) => u.planCount > 0 && u.profileScore >= 50),
        moderate: segmentedUsers.filter((u) => u.planCount > 0 && u.profileScore < 50),
        inactive: segmentedUsers.filter((u) => u.planCount === 0),
      },
      // 가입 시기별
      byJoinDate: {
        recent7d: segmentedUsers.filter((u) => new Date(u.created_at) >= sevenDaysAgo),
        recent30d: segmentedUsers.filter((u) => {
          const d = new Date(u.created_at);
          return d >= thirtyDaysAgo && d < sevenDaysAgo;
        }),
        older90d: segmentedUsers.filter((u) => {
          const d = new Date(u.created_at);
          return d >= ninetyDaysAgo && d < thirtyDaysAgo;
        }),
        veteran: segmentedUsers.filter((u) => new Date(u.created_at) < ninetyDaysAgo),
      },
      // 프로필 완성도별
      byProfile: {
        high: segmentedUsers.filter((u) => u.profileScore >= 70),
        medium: segmentedUsers.filter((u) => u.profileScore >= 30 && u.profileScore < 70),
        low: segmentedUsers.filter((u) => u.profileScore < 30),
      },
    };

    // 요약 통계
    const summary = {
      totalUsers: segmentedUsers.length,
      planDistribution: {
        "무료": segments.byPlan.free.length,
        "스타터": segments.byPlan.starter.length,
        "프로": segments.byPlan.pro.length,
        "엔터프라이즈": segments.byPlan.enterprise.length,
      },
      activityDistribution: {
        "활발": segments.byActivity.active.length,
        "보통": segments.byActivity.moderate.length,
        "비활성": segments.byActivity.inactive.length,
      },
      joinDistribution: {
        "최근 7일": segments.byJoinDate.recent7d.length,
        "최근 30일": segments.byJoinDate.recent30d.length,
        "30~90일": segments.byJoinDate.older90d.length,
        "90일+": segments.byJoinDate.veteran.length,
      },
      profileDistribution: {
        "높음 (70%+)": segments.byProfile.high.length,
        "보통 (30~70%)": segments.byProfile.medium.length,
        "낮음 (<30%)": segments.byProfile.low.length,
      },
    };

    return Response.json({ summary, segments });
  } catch (error) {
    console.error("[admin/segments] 오류:", error);
    return apiError(error, "세그먼트 조회 실패", 500);
  }
}
