import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from "@/lib/admin/auth";

/** GET: 서비스 KPI 대시보드 데이터 */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const supabase = createAdminClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // 총 사용자 수
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // 이번 주 신규 사용자
    const { count: newUsersWeek } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    // 총 사업계획서
    const { count: totalPlans } = await supabase
      .from('business_plans')
      .select('*', { count: 'exact', head: true });

    // 이번 주 사업계획서
    const { count: plansThisWeek } = await supabase
      .from('business_plans')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo);

    // 구독 현황
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('plan_type, status')
      .eq('status', 'active');

    const activeSubs = subscriptions?.length || 0;
    const proSubs = subscriptions?.filter((s) => s.plan_type === 'pro').length || 0;
    const enterpriseSubs = subscriptions?.filter((s) => s.plan_type === 'enterprise').length || 0;

    // AI 비용 (최근 7일)
    const { data: aiLogs } = await supabase
      .from('agent_logs')
      .select('cost_usd, input_tokens, output_tokens')
      .gte('created_at', sevenDaysAgo);

    const weeklyAiCost = aiLogs?.reduce((sum, log) => sum + (log.cost_usd || 0), 0) || 0;
    const weeklyTokens = aiLogs?.reduce(
      (sum, log) => sum + (log.input_tokens || 0) + (log.output_tokens || 0),
      0
    ) || 0;

    // 정부지원사업 매칭
    const { count: totalPrograms } = await supabase
      .from('programs')
      .select('*', { count: 'exact', head: true });

    // 최근 회의 수
    const { count: recentMeetings } = await supabase
      .from('agent_meetings')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    // 미션 통계
    const { data: missions } = await supabase
      .from('agent_missions')
      .select('approval_status, execution_status')
      .gte('created_at', thirtyDaysAgo);

    const missionStats = {
      total: missions?.length || 0,
      pending: missions?.filter((m) => m.approval_status === 'pending').length || 0,
      approved: missions?.filter((m) => m.approval_status === 'approved').length || 0,
      completed: missions?.filter((m) => m.execution_status === 'completed').length || 0,
    };

    return Response.json({
      kpi: {
        users: {
          total: totalUsers || 0,
          new_this_week: newUsersWeek || 0,
        },
        plans: {
          total: totalPlans || 0,
          this_week: plansThisWeek || 0,
        },
        subscriptions: {
          active: activeSubs,
          pro: proSubs,
          enterprise: enterpriseSubs,
        },
        ai: {
          weekly_cost: Math.round(weeklyAiCost * 100) / 100,
          weekly_tokens: weeklyTokens,
          cost_per_plan: plansThisWeek
            ? Math.round((weeklyAiCost / plansThisWeek) * 100) / 100
            : 0,
        },
        programs: {
          total: totalPrograms || 0,
        },
        meetings: {
          recent_count: recentMeetings || 0,
          missions: missionStats,
        },
      },
    });
  } catch (error) {
    console.error('KPI fetch error:', error);
    return Response.json({ error: 'Failed to fetch KPI data' }, { status: 500 });
  }
}
