import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
