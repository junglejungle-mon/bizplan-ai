import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * PATCH /api/plans/[id]/sections/[sId]
 * 섹션 내용 업데이트 (인라인 편집)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sId: string }> }
) {
  const { id: planId, sId: sectionId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 권한 확인
  const { data: plan } = await supabase
    .from("business_plans")
    .select("id, companies!inner(user_id)")
    .eq("id", planId)
    .single();

  if (!plan || (plan as any).companies?.user_id !== user.id) {
    return new Response("Not Found", { status: 404 });
  }

  const { content } = await request.json();

  if (typeof content !== "string") {
    return Response.json({ error: "content required" }, { status: 400 });
  }

  const { data: section, error } = await supabase
    .from("plan_sections")
    .update({
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sectionId)
    .eq("plan_id", planId)
    .select("id, section_name, content")
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ section });
}
