import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/admin/references — 레퍼런스 목록
 */
export async function GET(request: NextRequest) {
  const supabase = createAdminClient();
  const { searchParams } = request.nextUrl;

  let query = supabase
    .from("reference_documents")
    .select("*")
    .order("created_at", { ascending: false });

  const referenceType = searchParams.get("reference_type");
  const status = searchParams.get("status");

  if (referenceType) {
    query = query.eq("reference_type", referenceType);
  }
  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ documents: data || [] });
}

/**
 * POST /api/admin/references — 레퍼런스 업로드
 */
export async function POST(request: NextRequest) {
  const supabase = createAdminClient();
  const formData = await request.formData();

  const file = formData.get("file") as File;
  const title = formData.get("title") as string;
  const referenceType = (formData.get("reference_type") as string) || "business_plan";
  const templateType = (formData.get("template_type") as string) || "custom";

  if (!file || !title) {
    return NextResponse.json(
      { error: "파일과 제목은 필수입니다" },
      { status: 400 }
    );
  }

  // 1. Storage에 업로드
  const fileExt = file.name.split(".").pop();
  const fileName = `${Date.now()}-${file.name}`;
  const filePath = `${referenceType}/${fileName}`;

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage
    .from("references")
    .upload(filePath, arrayBuffer, {
      contentType: file.type || `application/${fileExt}`,
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      { error: `업로드 실패: ${uploadError.message}` },
      { status: 500 }
    );
  }

  // 2. DB에 레코드 생성
  const { data: doc, error: insertError } = await supabase
    .from("reference_documents")
    .insert({
      title,
      file_name: file.name,
      file_url: filePath,
      reference_type: referenceType,
      template_type: templateType,
      status: "pending",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json(
      { error: `DB 저장 실패: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ document: doc }, { status: 201 });
}
