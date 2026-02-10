import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/references/[id] — 레퍼런스 상세
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  const { data: document, error } = await supabase
    .from("reference_documents")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 청크 목록
  const { data: chunks } = await supabase
    .from("reference_chunks")
    .select("id, section_name, chunk_index, content, token_count")
    .eq("document_id", id)
    .order("chunk_index");

  return NextResponse.json({ document, chunks: chunks || [] });
}

/**
 * PATCH /api/admin/references/[id] — 레퍼런스 수정
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();
  const body = await request.json();

  const allowedFields = ["title", "reference_type", "template_type"];
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  const { data, error } = await supabase
    .from("reference_documents")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ document: data });
}

/**
 * DELETE /api/admin/references/[id] — 레퍼런스 삭제
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createAdminClient();

  // 1. Storage 파일 삭제
  const { data: doc } = await supabase
    .from("reference_documents")
    .select("file_url")
    .eq("id", id)
    .single();

  if (doc?.file_url) {
    await supabase.storage.from("references").remove([doc.file_url]);
  }

  // 2. DB 삭제 (CASCADE로 청크도 함께 삭제)
  const { error } = await supabase
    .from("reference_documents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
