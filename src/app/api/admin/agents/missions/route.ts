import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from "@/lib/admin/auth";

/** GET: 미션 목록 (필터: 승인상태, 팀, 실행상태) */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const approval = searchParams.get('approval'); // pending | approved | rejected | deferred
    const team = searchParams.get('team'); // team_id
    const execution = searchParams.get('execution'); // waiting | in_progress | completed | blocked
    const limit = parseInt(searchParams.get('limit') || '50');

    const supabase = createAdminClient();

    let query = supabase
      .from('agent_missions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (approval) {
      query = query.eq('approval_status', approval);
    }
    if (team) {
      query = query.eq('team_id', team);
    }
    if (execution) {
      query = query.eq('execution_status', execution);
    }

    const { data: missions, error } = await query;

    if (error) throw error;

    // 통계 (전체 기준)
    const { data: allMissions } = await supabase
      .from('agent_missions')
      .select('approval_status, execution_status');

    const stats = {
      total: allMissions?.length || 0,
      pending_approval: allMissions?.filter((m) => m.approval_status === 'pending').length || 0,
      approved: allMissions?.filter((m) => m.approval_status === 'approved').length || 0,
      in_progress: allMissions?.filter((m) => m.execution_status === 'in_progress').length || 0,
      completed: allMissions?.filter((m) => m.execution_status === 'completed').length || 0,
    };

    return Response.json({
      missions: missions || [],
      stats,
    });
  } catch (error) {
    console.error('Missions list error:', error);
    return Response.json({ error: 'Failed to fetch missions' }, { status: 500 });
  }
}
