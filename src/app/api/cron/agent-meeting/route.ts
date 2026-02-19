import { createAdminClient } from '@/lib/supabase/admin';

export const maxDuration = 300; // 5분 (Vercel Pro)

/** GET: Vercel Cron 트리거 (주간: 매주 월요일 / 월간: 매월 1일) */
export async function GET(request: Request) {
  try {
    // Cron 시크릿 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월
    const dayOfMonth = today.getDate();

    let meetingType: 'weekly' | 'monthly';

    // 매월 1일 → 월간 리뷰
    if (dayOfMonth === 1) {
      meetingType = 'monthly';
    }
    // 매주 월요일 → 주간 회의
    else if (dayOfWeek === 1) {
      meetingType = 'weekly';
    }
    // 그 외 → 트리거 안 함
    else {
      return Response.json({
        message: 'No meeting scheduled for today',
        dayOfWeek,
        dayOfMonth,
      });
    }

    const supabase = createAdminClient();
    const meetingDate = today.toISOString().split('T')[0];

    // 오늘 이미 같은 타입 회의가 있는지 확인 (중복 방지)
    const { data: existing } = await supabase
      .from('agent_meetings')
      .select('id')
      .eq('meeting_date', meetingDate)
      .eq('meeting_type', meetingType)
      .limit(1);

    if (existing && existing.length > 0) {
      return Response.json({
        message: `${meetingType} meeting already exists for ${meetingDate}`,
        existing_id: existing[0].id,
      });
    }

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
        triggered_by: 'cron',
      })
      .select()
      .single();

    if (error) throw error;

    // 파이프라인 실행 (동기, Cron은 maxDuration=300초)
    const { runMeetingPipeline } = await import('@/lib/agents/meeting-pipeline');
    await runMeetingPipeline(meeting.id, meetingType);

    return Response.json({
      success: true,
      meeting_id: meeting.id,
      meeting_type: meetingType,
      meeting_date: meetingDate,
    });
  } catch (error) {
    console.error('Cron agent-meeting error:', error);
    return Response.json({ error: 'Meeting pipeline failed' }, { status: 500 });
  }
}
