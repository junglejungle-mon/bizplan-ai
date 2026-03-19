import { createAdminClient } from '@/lib/supabase/admin';
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";
import { validateBody, updatePatternSchema } from "@/lib/api/validation";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const supabase = createAdminClient();

    const { data: patterns, error } = await supabase
      .from('winning_patterns')
      .select('*')
      .order('weight', { ascending: false });

    if (error) {
      return apiError(error, "패턴 처리 실패", 500);
    }

    return Response.json({ patterns: patterns || [] });
  } catch (error) {
    console.error('Winning patterns error:', error);
    return Response.json({ error: 'Failed to fetch winning patterns' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const [patternBody, patternErr] = await validateBody(request, updatePatternSchema);
    if (patternErr) return patternErr;
    const { id, ...updates } = patternBody as { id: string; [key: string]: unknown };

    const { data: pattern, error } = await supabase
      .from('winning_patterns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return apiError(error, "패턴 처리 실패", 500);
    }

    return Response.json({ pattern });
  } catch (error) {
    console.error('Update winning pattern error:', error);
    return Response.json({ error: 'Failed to update winning pattern' }, { status: 500 });
  }
}
