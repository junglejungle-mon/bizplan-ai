import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: patterns, error } = await supabase
      .from('winning_patterns')
      .select('*')
      .order('weight', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ patterns: patterns || [] });
  } catch (error) {
    console.error('Winning patterns error:', error);
    return Response.json({ error: 'Failed to fetch winning patterns' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = createAdminClient();
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return Response.json({ error: 'Pattern id is required' }, { status: 400 });
    }

    const { data: pattern, error } = await supabase
      .from('winning_patterns')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ pattern });
  } catch (error) {
    console.error('Update winning pattern error:', error);
    return Response.json({ error: 'Failed to update winning pattern' }, { status: 500 });
  }
}
