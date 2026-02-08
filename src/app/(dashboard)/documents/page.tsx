import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DocumentList } from "@/components/documents/document-list";

export default async function DocumentsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  const { data: documents } = await supabase
    .from("company_documents")
    .select("id, document_type, status, extracted_data, file_url")
    .eq("company_id", company.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류관리</h1>
        <p className="text-gray-500">
          서류를 업로드하면 AI가 자동으로 데이터를 추출하여 사업계획서 품질을 향상시킵니다
        </p>
      </div>

      <DocumentList documents={documents ?? []} />
    </div>
  );
}
