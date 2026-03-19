import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";
import { validateBody, adminUpdateProgramSchema } from "@/lib/api/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;

    const { data: program, error } = await supabase
      .from('programs')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !program) {
      return Response.json({ error: 'Program not found' }, { status: 404 });
    }

    const { count: matchingCount } = await supabase
      .from('matchings')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id);

    const { data: relatedPlans } = await supabase
      .from('business_plans')
      .select('id, title, status, quality_score, created_at')
      .eq('program_id', id);

    return Response.json({
      program,
      matchingCount: matchingCount || 0,
      relatedPlans: relatedPlans || [],
    });
  } catch (error) {
    console.error('Program detail error:', error);
    return Response.json({ error: 'Failed to fetch program' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;
    const [progBody, progErr] = await validateBody(request, adminUpdateProgramSchema);
    if (progErr) return progErr;

    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(progBody)) {
      if (value !== undefined) updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: program, error } = await supabase
      .from('programs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError(error, "프로그램 수정 실패", 500);
    }

    return Response.json({ program });
  } catch (error) {
    console.error('Program update error:', error);
    return Response.json({ error: 'Failed to update program' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;

    const { count: matchingCount } = await supabase
      .from('matchings')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', id);

    if (matchingCount && matchingCount > 0) {
      return Response.json(
        { error: `이 프로그램에 ${matchingCount}개의 매칭이 있어 삭제할 수 없습니다.` },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from('programs')
      .delete()
      .eq('id', id);

    if (error) {
      return apiError(error, "프로그램 삭제 실패", 500);
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('Program delete error:', error);
    return Response.json({ error: 'Failed to delete program' }, { status: 500 });
  }
}
