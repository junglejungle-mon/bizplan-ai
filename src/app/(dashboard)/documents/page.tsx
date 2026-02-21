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
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  const { data: documents } = await supabase
    .from("company_documents")
    .select("id, document_type, status, extracted_data, file_url, created_at, updated_at")
    .eq("company_id", company.id)
    .order("updated_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">서류관리</h1>
        <p className="text-gray-500">
          서류를 업로드하면 AI가 자동으로 데이터를 추출하여 사업계획서 품질을 향상시킵니다
        </p>
        {documents && documents.length > 0 && (
          <div className="flex items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              분석완료 {documents.filter((d: {status: string}) => d.status === "extracted").length}건
            </span>
            {documents.filter((d: {status: string}) => d.status === "processing").length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-50 text-amber-700">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                분석중 {documents.filter((d: {status: string}) => d.status === "processing").length}건
              </span>
            )}
            {documents.filter((d: {status: string}) => d.status === "error").length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-red-50 text-red-700">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                오류 {documents.filter((d: {status: string}) => d.status === "error").length}건
              </span>
            )}
            <span className="text-xs text-gray-400">
              총 {documents.length}건
            </span>
          </div>
        )}
      </div>

      <DocumentList documents={documents ?? []} />
    </div>
  );
}
