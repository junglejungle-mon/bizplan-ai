import { NextRequest } from 'next/server';
import { requireAdmin } from "@/lib/admin/auth";

export const maxDuration = 300; // 5분 (Vercel Pro)

/** POST: 회의 파이프라인 실행 (비동기 트리거) */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const { id } = await params;

    const { runMeetingPipeline } = await import('@/lib/agents/meeting-pipeline');
    await runMeetingPipeline(id, 'weekly');

    return Response.json({ success: true, meeting_id: id });
  } catch (error) {
    console.error('Meeting pipeline run error:', error);
    return Response.json({ error: 'Pipeline execution failed' }, { status: 500 });
  }
}
