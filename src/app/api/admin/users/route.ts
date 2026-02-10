import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    // For each user, get company and plan count
    const enriched = [];
    for (const user of users || []) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, company_name')
        .eq('user_id', user.id)
        .maybeSingle();

      const { count: planCount } = await supabase
        .from('business_plans')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', company?.id);

      enriched.push({
        ...user,
        company,
        planCount: planCount || 0,
      });
    }

    return Response.json({ users: enriched });
  } catch (error) {
    console.error('Users list error:', error);
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
