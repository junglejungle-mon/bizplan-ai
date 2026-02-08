import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/documents/upload
 * 서류 파일 업로드 → Supabase Storage → 메타데이터 저장
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  // FormData 파싱
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const documentType = formData.get("documentType") as string | null;
  const source = (formData.get("source") as string) || "manual_upload";

  if (!file) {
    return Response.json({ error: "파일이 필요합니다" }, { status: 400 });
  }

  if (!documentType) {
    return Response.json(
      { error: "문서 유형이 필요합니다" },
      { status: 400 }
    );
  }

  // 파일 크기 제한 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return Response.json(
      { error: "파일 크기는 10MB 이하여야 합니다" },
      { status: 400 }
    );
  }

  // 허용된 파일 유형
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    return Response.json(
      { error: "PDF, PNG, JPG, WebP 파일만 업로드 가능합니다" },
      { status: 400 }
    );
  }

  try {
    // Supabase Storage에 파일 업로드 (admin 클라이언트 사용)
    const admin = createAdminClient();
    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${company.id}/${documentType}_${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Documents] Storage upload error:", uploadError);
      return Response.json(
        { error: `파일 업로드 실패: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 파일 URL 생성
    const {
      data: { publicUrl },
    } = admin.storage.from("documents").getPublicUrl(fileName);

    // 기존 같은 문서 유형이 있으면 업데이트, 없으면 새로 생성
    const { data: existing } = await supabase
      .from("company_documents")
      .select("id")
      .eq("company_id", company.id)
      .eq("document_type", documentType)
      .limit(1);

    let doc;
    if (existing && existing.length > 0) {
      // 기존 문서 업데이트
      const { data, error } = await supabase
        .from("company_documents")
        .update({
          file_url: publicUrl,
          source,
          status: "uploaded",
          extracted_data: null, // 재업로드 시 추출 데이터 초기화
        })
        .eq("id", existing[0].id)
        .select()
        .single();

      if (error) throw error;
      doc = data;
    } else {
      // 새 문서 생성
      const { data, error } = await supabase
        .from("company_documents")
        .insert({
          company_id: company.id,
          document_type: documentType,
          source,
          file_url: publicUrl,
          status: "uploaded",
        })
        .select()
        .single();

      if (error) throw error;
      doc = data;
    }

    return Response.json({
      document: doc,
      storagePath: fileName,
    });
  } catch (error) {
    console.error("[Documents] Upload error:", error);
    return Response.json(
      { error: `업로드 처리 중 오류: ${String(error)}` },
      { status: 500 }
    );
  }
}
