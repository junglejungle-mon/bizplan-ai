import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { requireAdmin } from "@/lib/admin/auth";

/** GET: 회의 상세 + 미션 목록 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const supabase = createAdminClient();

    // 회의 상세
    const { data: meeting, error: meetingError } = await supabase
      .from('agent_meetings')
      .select('*')
      .eq('id', id)
      .single();

    if (meetingError || !meeting) {
      return Response.json({ error: 'Meeting not found' }, { status: 404 });
    }

    // 해당 회의의 미션 목록
    const { data: missions, error: missionsError } = await supabase
      .from('agent_missions')
      .select('*')
      .eq('meeting_id', id)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true });

    if (missionsError) throw missionsError;

    // 통계
    const stats = {
      total: missions?.length || 0,
      pending: missions?.filter((m) => m.approval_status === 'pending').length || 0,
      approved: missions?.filter((m) => m.approval_status === 'approved').length || 0,
      rejected: missions?.filter((m) => m.approval_status === 'rejected').length || 0,
      in_progress: missions?.filter((m) => m.execution_status === 'in_progress').length || 0,
      completed: missions?.filter((m) => m.execution_status === 'completed').length || 0,
    };

    return Response.json({
      meeting,
      missions: missions || [],
      stats,
    });
  } catch (error) {
    console.error('Meeting detail error:', error);
    return Response.json({ error: 'Failed to fetch meeting detail' }, { status: 500 });
  }
}
