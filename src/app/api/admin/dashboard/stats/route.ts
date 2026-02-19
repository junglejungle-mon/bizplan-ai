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
      const recentUsers = (recentUsersRaw || []).map((u: any) => ({ ...u, full_name: u.name }));

      // Quality scores average
      const { data: qualityAvg } = await supabase
        .from('quality_scores')
        .select('total_score');

      const avgScore =
        qualityAvg && qualityAvg.length > 0
          ? qualityAvg.reduce((sum: number, q: any) => sum + (q.total_score || 0), 0) / qualityAvg.length
          : 0;

      // Active programs (deadline not passed)
      const { count: activePrograms } = await supabase
        .from('programs')
        .select('id', { count: 'exact', head: true })
        .gte('apply_end', new Date().toISOString().split('T')[0]);

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
      };
    });

    return Response.json(stats);
  } catch (error) {
    log.error({ err: error }, '대시보드 통계 조회 실패');
    return Response.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
