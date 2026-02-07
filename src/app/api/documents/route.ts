import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/documents — 서류 목록
 * POST /api/documents — 서류 업로드 메타데이터 저장
 */
export async function GET() {
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
    return Response.json({ documents: [] });
  }

  const { data: documents } = await supabase
    .from("company_documents")
    .select("*")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return Response.json({ documents: documents ?? [] });
}

export async function POST(request: NextRequest) {
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
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  const body = await request.json();
  const { documentType, source, fileUrl, issuedDate } = body;

  const { data: doc, error } = await supabase
    .from("company_documents")
    .insert({
      company_id: company.id,
      document_type: documentType,
      source: source || "manual_upload",
      file_url: fileUrl || null,
      issued_date: issuedDate || null,
      status: "uploaded",
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ document: doc });
}
