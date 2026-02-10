import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
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

    // Recent activity: last 5 plans, last 5 signups
    const { data: recentPlans } = await supabase
      .from('business_plans')
      .select('id, title, status, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    // Quality scores average
    const { data: qualityAvg } = await supabase
      .from('quality_scores')
      .select('total_score');

    const avgScore =
      qualityAvg && qualityAvg.length > 0
        ? qualityAvg.reduce((sum, q) => sum + (q.total_score || 0), 0) / qualityAvg.length
        : 0;

    // Active programs (deadline not passed)
    const { count: activePrograms } = await supabase
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .gte('deadline', new Date().toISOString().split('T')[0]);

    return Response.json({
      counts: {
        companies: companies.count || 0,
        plans: plans.count || 0,
        programs: programs.count || 0,
        matchings: matchings.count || 0,
        references: references.count || 0,
        chunks: chunks.count || 0,
        profiles: profiles.count || 0,
      },
      activePrograms: activePrograms || 0,
      averageQualityScore: Math.round(avgScore * 100) / 100,
      recentPlans: recentPlans || [],
      recentUsers: recentUsers || [],
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    return Response.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 });
  }
}
