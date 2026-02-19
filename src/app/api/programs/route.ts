import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = parseInt(searchParams.get("offset") || "0");

  let query = supabase
    .from("programs")
    .select("*", { count: "exact" })
    .order("collected_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (source) {
    query = query.eq("source", source);
  }

  const { data, error, count } = await query;

  if (error) {
    return apiError(error, "지원사업 조회에 실패했습니다", 500);
  }

  return Response.json({ programs: data, total: count });
}
