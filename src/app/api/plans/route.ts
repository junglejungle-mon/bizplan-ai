import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) {
    return Response.json({ plans: [] });
  }

  const { data: plans, error } = await supabase
    .from("business_plans")
    .select("*, programs(title)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ plans });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { programId, title } = await request.json();

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  // 매칭 찾기
  let matchingId = null;
  if (programId) {
    const { data: matching } = await supabase
      .from("matchings")
      .select("id")
      .eq("company_id", company.id)
      .eq("program_id", programId)
      .single();
    matchingId = matching?.id;
  }

  const { data: plan, error } = await supabase
    .from("business_plans")
    .insert({
      company_id: company.id,
      program_id: programId || null,
      matching_id: matchingId,
      title: title || "새 사업계획서",
      status: "draft",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ plan });
}
