import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    let query = supabase
      .from('programs')
      .select('id, title, status, category, deadline, support_amount, target, created_at', { count: 'exact' });

    if (search) {
      query = query.ilike('title', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const from = (page - 1) * limit;
    query = query.order('created_at', { ascending: false }).range(from, from + limit - 1);

    const { data: programs, count, error } = await query;

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({
      programs: programs || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error) {
    console.error('Programs list error:', error);
    return Response.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/programs/collect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return Response.json({ error: 'Collection trigger failed', details: result }, { status: response.status });
    }

    return Response.json({ message: 'Program collection triggered', result });
  } catch (error) {
    console.error('Program collection trigger error:', error);
    return Response.json({ error: 'Failed to trigger program collection' }, { status: 500 });
  }
}
