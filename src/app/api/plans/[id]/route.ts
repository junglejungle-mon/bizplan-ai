import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { apiError } from "@/lib/api/error";

/**
 * GET /api/plans/[id] — 사업계획서 상세 조회
 * PUT /api/plans/[id] — 사업계획서 업데이트
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: plan } = await supabase
    .from("business_plans")
    .select("*, programs(*)")
    .eq("id", id)
    .single();

  if (!plan) {
    return new Response("Not Found", { status: 404 });
  }

  const { data: sections } = await supabase
    .from("plan_sections")
    .select("*")
    .eq("plan_id", id)
    .order("section_order");

  return Response.json({ plan, sections });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const updates = await request.json();

  const { data: plan, error } = await supabase
    .from("business_plans")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return apiError(error, "사업계획서 수정에 실패했습니다", 500);
  }

  return Response.json({ plan });
}

/**
 * DELETE /api/plans/[id] — 사업계획서 삭제
 * 관련 섹션, IR 프레젠테이션, IR 슬라이드도 함께 삭제
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  // 본인 소유 계획서인지 확인
  const { data: plan } = await supabase
    .from("business_plans")
    .select("id, company_id, companies(user_id)")
    .eq("id", id)
    .single();

  if (!plan) {
    return Response.json({ error: "계획서를 찾을 수 없습니다" }, { status: 404 });
  }

  const ownerUserId = (plan.companies as any)?.user_id;
  if (ownerUserId !== user.id) {
    return Response.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
  }

  // 1. IR 슬라이드 삭제 (ir_presentations → ir_slides)
  const { data: irPresentations } = await supabase
    .from("ir_presentations")
    .select("id")
    .eq("plan_id", id);

  if (irPresentations && irPresentations.length > 0) {
    const irIds = irPresentations.map((ir: any) => ir.id);
    await supabase.from("ir_slides").delete().in("presentation_id", irIds);
    await supabase.from("ir_presentations").delete().eq("plan_id", id);
  }

  // 2. 섹션 삭제
  await supabase.from("plan_sections").delete().eq("plan_id", id);

  // 3. 계획서 삭제
  const { error, count } = await supabase
    .from("business_plans")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return apiError(error, "사업계획서 삭제에 실패했습니다", 500);
  }

  // RLS가 삭제를 차단한 경우 대비
  const { data: stillExists } = await supabase
    .from("business_plans")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (stillExists) {
    return Response.json({ error: "삭제에 실패했습니다. 권한을 확인해주세요." }, { status: 500 });
  }

  return Response.json({ success: true });
}
