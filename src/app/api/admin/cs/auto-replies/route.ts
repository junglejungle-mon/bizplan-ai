import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

/**
 * GET /api/admin/cs/auto-replies — 자동응답 목록 조회
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cs_auto_replies")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    return apiError(error, "자동응답 목록 조회 실패", 500);
  }

  return NextResponse.json({ autoReplies: data || [] });
}

/**
 * PUT /api/admin/cs/auto-replies — 자동응답 활성/비활성 토글
 */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const body = await request.json();

  const { id, is_active } = body;
  if (!id) {
    return NextResponse.json({ error: "ID는 필수입니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cs_auto_replies")
    .update({ is_active })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return apiError(error, "자동응답 수정 실패", 500);
  }

  return NextResponse.json({ autoReply: data });
}
