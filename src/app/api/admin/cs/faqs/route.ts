import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

/**
 * GET /api/admin/cs/faqs — FAQ 목록 조회
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("cs_faqs")
    .select("*")
    .order("category")
    .order("order", { ascending: true });

  if (error) {
    return apiError(error, "FAQ 목록 조회 실패", 500);
  }

  return NextResponse.json({ faqs: data || [] });
}

/**
 * POST /api/admin/cs/faqs — FAQ 추가
 */
export async function POST(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const body = await request.json();

  const { question, answer, category } = body;
  if (!question || !answer) {
    return NextResponse.json(
      { error: "질문과 답변은 필수입니다" },
      { status: 400 }
    );
  }

  // 해당 카테고리의 max order 조회
  const { data: maxOrderData } = await supabase
    .from("cs_faqs")
    .select("order")
    .eq("category", category || "general")
    .order("order", { ascending: false })
    .limit(1);

  const nextOrder = (maxOrderData?.[0]?.order ?? 0) + 1;

  const { data, error } = await supabase
    .from("cs_faqs")
    .insert({
      question,
      answer,
      category: category || "general",
      order: nextOrder,
    })
    .select()
    .single();

  if (error) {
    return apiError(error, "FAQ 추가 실패", 500);
  }

  return NextResponse.json({ faq: data }, { status: 201 });
}

/**
 * PUT /api/admin/cs/faqs — FAQ 수정
 */
export async function PUT(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const body = await request.json();

  const { id, question, answer, category } = body;
  if (!id) {
    return NextResponse.json({ error: "ID는 필수입니다" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("cs_faqs")
    .update({ question, answer, category })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return apiError(error, "FAQ 수정 실패", 500);
  }

  return NextResponse.json({ faq: data });
}

/**
 * DELETE /api/admin/cs/faqs — FAQ 삭제
 */
export async function DELETE(request: NextRequest) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID는 필수입니다" }, { status: 400 });
  }

  const { error } = await supabase.from("cs_faqs").delete().eq("id", id);

  if (error) {
    return apiError(error, "FAQ 삭제 실패", 500);
  }

  return NextResponse.json({ success: true });
}
