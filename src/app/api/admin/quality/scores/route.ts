import { createAdminClient } from '@/lib/supabase/admin';
import { scorePlan } from '@/lib/quality/scorer';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const planId = searchParams.get('planId');

    let query = supabase
      .from('quality_scores')
      .select('*, plan_sections(section_name), business_plans(title)')
      .order('created_at', { ascending: false });

    if (planId) {
      query = query.eq('plan_id', planId);
    }

    query = query.limit(50);

    const { data: scores, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ scores: scores || [] });
  } catch (error) {
    console.error('Quality scores error:', error);
    return Response.json({ error: 'Failed to fetch quality scores' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { planId } = await request.json();

    if (!planId) {
      return Response.json({ error: 'planId is required' }, { status: 400 });
    }

    const results = await scorePlan(planId);

    return Response.json({ results });
  } catch (error) {
    console.error('Quality scoring error:', error);
    return Response.json({ error: 'Failed to score plan' }, { status: 500 });
  }
}
