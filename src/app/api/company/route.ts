import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: company, error } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (error) {
    return apiError(error, "기업 정보를 찾을 수 없습니다", 404);
  }

  return Response.json({ company });
}

export async function PUT(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const updates = await request.json();

  const { data: company, error } = await supabase
    .from("companies")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) {
    return apiError(error, "기업 정보 수정에 실패했습니다", 500);
  }

  return Response.json({ company });
}
