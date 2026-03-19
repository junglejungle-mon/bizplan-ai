import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateBody, interviewResetSchema } from "@/lib/api/validation";

/**
 * POST /api/company/interview/reset
 * 인터뷰 리셋 — 기존 Q&A 삭제, business_content 초기화
 * body: { companyId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [resetBody, resetErr] = await validateBody(request, interviewResetSchema);
  if (resetErr) return resetErr;
  const { companyId } = resetBody;

  // 본인 회사인지 확인
  const { data: company } = await supabase
    .from("companies")
    .select("id, user_id")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .single();

  if (!company) {
    return Response.json({ error: "회사를 찾을 수 없습니다" }, { status: 404 });
  }

  const admin = createAdminClient();

  // 1. 인터뷰 Q&A 전부 삭제
  const { error: deleteError } = await admin
    .from("company_interviews")
    .delete()
    .eq("company_id", companyId);

  if (deleteError) {
    console.error("[Interview Reset] 삭제 실패:", deleteError.message);
    return Response.json({ error: "인터뷰 삭제 실패" }, { status: 500 });
  }

  // 2. business_content 초기화 + profile_score 리셋
  const { error: updateError } = await admin
    .from("companies")
    .update({
      business_content: null,
      profile_score: 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", companyId);

  if (updateError) {
    console.error("[Interview Reset] 회사 업데이트 실패:", updateError.message);
  }

  return Response.json({
    success: true,
    message: "인터뷰가 초기화되었습니다. 처음부터 다시 시작합니다.",
  });
}
