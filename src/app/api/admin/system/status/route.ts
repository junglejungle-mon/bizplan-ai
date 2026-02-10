import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    // Agent logs summary - last 20 logs
    const { data: recentLogs } = await supabase
      .from('agent_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Aggregate: total cost, total tokens by day (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: dailyStats } = await supabase
      .from('agent_logs')
      .select('skill_name, input_tokens, output_tokens, cost_usd, status, created_at')
      .gte('created_at', sevenDaysAgo);

    // Compute daily aggregations
    const dailyAggregation: Record<string, {
      date: string;
      totalInputTokens: number;
      totalOutputTokens: number;
      totalCost: number;
      requestCount: number;
      errorCount: number;
    }> = {};

    for (const log of dailyStats || []) {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!dailyAggregation[date]) {
        dailyAggregation[date] = {
          date,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCost: 0,
          requestCount: 0,
          errorCount: 0,
        };
      }
      dailyAggregation[date].totalInputTokens += log.input_tokens || 0;
      dailyAggregation[date].totalOutputTokens += log.output_tokens || 0;
      dailyAggregation[date].totalCost += log.cost_usd || 0;
      dailyAggregation[date].requestCount += 1;
      if (log.status === 'error') {
        dailyAggregation[date].errorCount += 1;
      }
    }

    const dailySummary = Object.values(dailyAggregation).sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    // Cron status - last program collection
    const { data: lastCollection } = await supabase
      .from('programs')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Failed reference docs
    const { data: failedDocs } = await supabase
      .from('reference_documents')
      .select('id, title, status')
      .eq('status', 'failed');

    return Response.json({
      recentLogs: recentLogs || [],
      dailySummary,
      lastProgramCollection: lastCollection?.created_at || null,
      failedDocs: failedDocs || [],
      failedDocsCount: failedDocs?.length || 0,
    });
  } catch (error) {
    console.error('System status error:', error);
    return Response.json({ error: 'Failed to fetch system status' }, { status: 500 });
  }
}
