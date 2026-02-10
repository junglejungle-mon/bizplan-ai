import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = createAdminClient();
    const { id } = await params;

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch company
    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', id)
      .maybeSingle();

    // Fetch interviews (via company)
    let interviews: unknown[] = [];
    if (company) {
      const { data: companyInterviews } = await supabase
        .from('company_interviews')
        .select('*')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });
      interviews = companyInterviews || [];
    }

    // Fetch business plans (via company)
    let plans: unknown[] = [];
    if (company) {
      const { data: companyPlans } = await supabase
        .from('business_plans')
        .select('id, title, status, quality_score, created_at, updated_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false });

      plans = companyPlans || [];
    }

    // Fetch matchings for this user's plans
    const planIds = (plans as { id: string }[]).map((p) => p.id);
    let matchings: unknown[] = [];
    if (planIds.length > 0) {
      const { data: planMatchings } = await supabase
        .from('matchings')
        .select('*, programs(title, deadline, support_amount)')
        .in('plan_id', planIds)
        .order('created_at', { ascending: false });

      matchings = planMatchings || [];
    }

    return Response.json({
      profile,
      company,
      interviews,
      plans,
      matchings,
    });
  } catch (error) {
    console.error('User detail error:', error);
    return Response.json({ error: 'Failed to fetch user details' }, { status: 500 });
  }
}
