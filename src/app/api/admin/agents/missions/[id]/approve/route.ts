import { createAdminClient } from '@/lib/supabase/admin';
import { NextRequest } from 'next/server';
import { requireAdmin } from "@/lib/admin/auth";

/** POST: 미션 승인/반려/보류 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;
    const body = await request.json();
    const { action, reason } = body;

    if (!['approve', 'reject', 'defer'].includes(action)) {
      return Response.json(
        { error: 'Invalid action. Use: approve, reject, defer' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 미션 존재 확인
    const { data: mission, error: fetchError } = await supabase
      .from('agent_missions')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !mission) {
      return Response.json({ error: 'Mission not found' }, { status: 404 });
    }

    const statusMap: Record<string, string> = {
      approve: 'approved',
      reject: 'rejected',
      defer: 'deferred',
    };

    const updateData: Record<string, unknown> = {
      approval_status: statusMap[action],
    };

    if (action === 'approve') {
      updateData.approved_at = new Date().toISOString();
      updateData.execution_status = 'waiting';
    } else if (action === 'reject') {
      updateData.rejection_reason = reason || null;
      updateData.execution_status = 'cancelled';
    }

    const { data: updated, error: updateError } = await supabase
      .from('agent_missions')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    const actionLabels: Record<string, string> = { approve: '승인', reject: '반려', defer: '보류' };
    const actionLabel = actionLabels[action];

    return Response.json({
      success: true,
      mission: updated,
      message: `미션 "${mission.title}"이(가) ${actionLabel}되었습니다.`,
    });
  } catch (error) {
    console.error('Mission approve error:', error);
    return Response.json({ error: 'Failed to update mission' }, { status: 500 });
  }
}
