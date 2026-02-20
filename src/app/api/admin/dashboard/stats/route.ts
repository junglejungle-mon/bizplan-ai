import { createAdminClient } from '@/lib/supabase/admin';
import { cache } from '@/lib/redis';
import { adminLogger as log } from '@/lib/logger';
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/dashboard/stats
 * 대시보드 통계 (Redis 캐싱: 5분 TTL)
 */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    // 대시보드 통계는 자주 변경되지 않으므로 5분 캐싱
    const stats = await cache.getOrSet('dashboard:stats', 300, async () => {
      const supabase = createAdminClient();

      // Query all counts in parallel
      const [companies, plans, programs, matchings, references, chunks, profiles] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }),
        supabase.from('business_plans').select('id', { count: 'exact', head: true }),
        supabase.from('programs').select('id', { count: 'exact', head: true }),
        supabase.from('matchings').select('id', { count: 'exact', head: true }),
        supabase.from('reference_documents').select('id', { count: 'exact', head: true }),
        supabase.from('reference_chunks').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
      ]);

      // Subscription & payment stats (with graceful fallback)
      let activeSubscriptions = 0;
      let totalRevenue = 0;
      let monthlyRevenue = 0;
      let recentPayments: Array<{
        id: string;
        amount: number;
        status: string;
        payment_method: string | null;
        created_at: string;
      }> = [];

      try {
        const { count: activeSubs } = await supabase
          .from('subscriptions')
          .select('id', { count: 'exact', head: true })
          .in('status', ['active', 'trialing']);
        activeSubscriptions = activeSubs || 0;

        // Total revenue (all paid payments)
        const { data: paidPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'paid');
        totalRevenue = paidPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        // This month's revenue
        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);
        const { data: monthPayments } = await supabase
          .from('payments')
          .select('amount')
          .eq('status', 'paid')
          .gte('paid_at', thisMonth.toISOString());
        monthlyRevenue = monthPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        // Recent 5 payments
        const { data: recentPmts } = await supabase
          .from('payments')
          .select('id, amount, status, payment_method, created_at')
          .order('created_at', { ascending: false })
          .limit(5);
        recentPayments = recentPmts || [];
      } catch {
        // subscription/payment tables may not exist yet
      }

      // Recent activity: last 5 plans, last 5 signups
      const { data: recentPlans } = await supabase
        .from('business_plans')
        .select('id, title, status, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: recentUsersRaw } = await supabase
        .from('profiles')
        .select('id, name, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5);
      const recentUsers = (recentUsersRaw || []).map((u: { id: string; name: string | null; email: string | null; created_at: string }) => ({ ...u, full_name: u.name }));

      // Quality scores average
      const { data: qualityAvg } = await supabase
        .from('quality_scores')
        .select('total_score');

      const avgScore =
        qualityAvg && qualityAvg.length > 0
          ? qualityAvg.reduce((sum: number, q: { total_score: number | null }) => sum + (q.total_score || 0), 0) / qualityAvg.length
          : 0;

      // Active programs (deadline not passed)
      const { count: activePrograms } = await supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .gte('apply_end', new Date().toISOString().split('T')[0]);

      // ============================================================
      // 핵심 지표: DAU / WAU / 리텐션 / 인터뷰 완료율
      // ============================================================
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let dau = 0;
      let wau = 0;
      let retention7d = 0;
      let interviewCompletionRate = 0;

      try {
        // auth.users에서 last_sign_in_at 기반 DAU/WAU/리텐션 계산 (admin client)
        const { data: authDau } = await supabase.auth.admin.listUsers({
          page: 1,
          perPage: 1000,
        });
        if (authDau?.users) {
          dau = authDau.users.filter(u =>
            u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(oneDayAgo)
          ).length;
          wau = authDau.users.filter(u =>
            u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(sevenDaysAgo)
          ).length;

          // 7일 리텐션: 7일 전~14일 전 가입자 중 최근 7일 이내 로그인한 비율
          const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
          const cohort = authDau.users.filter(u =>
            u.created_at &&
            new Date(u.created_at) >= new Date(fourteenDaysAgo) &&
            new Date(u.created_at) < new Date(sevenDaysAgo)
          );
          if (cohort.length > 0) {
            const retained = cohort.filter(u =>
              u.last_sign_in_at && new Date(u.last_sign_in_at) >= new Date(sevenDaysAgo)
            ).length;
            retention7d = Math.round((retained / cohort.length) * 100);
          }
        }
      } catch {
        // auth.admin이 없을 수 있음 — agent_logs fallback
        const { data: logUsers24h } = await supabase
          .from('agent_logs')
          .select('user_id')
          .gte('created_at', oneDayAgo);
        dau = new Set(logUsers24h?.map(l => l.user_id).filter(Boolean)).size;

        const { data: logUsers7d } = await supabase
          .from('agent_logs')
          .select('user_id')
          .gte('created_at', sevenDaysAgo);
        wau = new Set(logUsers7d?.map(l => l.user_id).filter(Boolean)).size;
      }

      // 인터뷰 완료율: 전체 기업 중 인터뷰 round 5까지 완료한 기업 비율
      try {
        const { data: allCompanies } = await supabase
          .from('companies')
          .select('id');
        const totalCompanies = allCompanies?.length || 0;

        if (totalCompanies > 0) {
          const { data: completedInterviews } = await supabase
            .from('company_interviews')
            .select('company_id, round')
            .eq('round', 5);
          const companiesWithRound5 = new Set(
            completedInterviews?.map(i => i.company_id) || []
          ).size;
          interviewCompletionRate = Math.round((companiesWithRound5 / totalCompanies) * 100);
        }
      } catch {
        // company_interviews 테이블이 없을 수 있음
      }

      return {
        companies: companies.count || 0,
        plans: plans.count || 0,
        programs: programs.count || 0,
        matchings: matchings.count || 0,
        references: references.count || 0,
        chunks: chunks.count || 0,
        profiles: profiles.count || 0,
        activePrograms: activePrograms || 0,
        avgQualityScore: avgScore > 0 ? Math.round(avgScore * 100) / 100 : null,
        activeSubscriptions,
        totalRevenue,
        monthlyRevenue,
        recentPlans: recentPlans || [],
        recentUsers: recentUsers || [],
        recentPayments,
        // 핵심 지표 (W08 KPI)
        dau,
        wau,
        retention7d,
        interviewCompletionRate,
      };
    });

    return Response.json(stats);
  } catch (error) {
    log.error({ err: error }, '대시보드 통계 조회 실패');
    return Response.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
