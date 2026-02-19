import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from "@/lib/admin/auth";

/** POST: 회의 트리거 (weekly/monthly) */
export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const body = await request.json();
    const meetingType = body.type || 'weekly';

    if (!['weekly', 'monthly'].includes(meetingType)) {
      return Response.json({ error: 'Invalid meeting type' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const today = new Date();
    const meetingDate = today.toISOString().split('T')[0];

    // 주 번호 계산
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(
      ((today.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7
    );

    // 회의 레코드 생성
    const { data: meeting, error } = await supabase
      .from('agent_meetings')
      .insert({
        meeting_type: meetingType,
        meeting_date: meetingDate,
        week_number: weekNumber,
        status: 'pending',
        triggered_by: 'manual',
      })
      .select()
      .single();

    if (error) throw error;

    // 비동기로 파이프라인 시작 (직접 import, HTTP 호출 대신)
    import('@/lib/agents/meeting-pipeline')
      .then(({ runMeetingPipeline }) => runMeetingPipeline(meeting.id, meetingType))
      .catch((err) => console.error('Pipeline execution failed:', err));

    return Response.json({
      success: true,
      meeting,
      message: `${meetingType === 'weekly' ? '주간' : '월간'} 회의가 시작되었습니다.`,
    });
  } catch (error) {
    console.error('Meeting trigger error:', error);
    return Response.json({ error: 'Failed to trigger meeting' }, { status: 500 });
  }
}

/** GET: 회의 목록 조회 */
export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20');
    const type = searchParams.get('type'); // weekly | monthly

    const supabase = createAdminClient();

    let query = supabase
      .from('agent_meetings')
      .select('*')
      .order('meeting_date', { ascending: false })
      .limit(limit);

    if (type && ['weekly', 'monthly'].includes(type)) {
      query = query.eq('meeting_type', type);
    }

    const { data: meetings, error } = await query;

    if (error) throw error;

    return Response.json({
      meetings: meetings || [],
      total: meetings?.length || 0,
    });
  } catch (error) {
    console.error('Meeting list error:', error);
    return Response.json({ error: 'Failed to fetch meetings' }, { status: 500 });
  }
}
