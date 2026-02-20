import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { IRShowcase } from "@/components/ir/ir-showcase";

export default async function IRPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 사용자의 기존 IR 확인
  const { data: rawUserIRs } = await supabase
    .from("ir_presentations")
    .select("id, plan_id, title, template, status, created_at, business_plans(title)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const userIRs = (rawUserIRs || []).map((ir: { id: string; plan_id: string | null; title: string; template: string; status: string; created_at: string; business_plans: unknown }) => ({
    id: ir.id,
    plan_id: ir.plan_id as string,
    title: ir.title,
    template: ir.template,
    status: ir.status,
    created_at: ir.created_at,
    business_plans: ir.business_plans as { title: string } | null,
  }));

  // 샘플 IR 가져오기 (예시용)
  let sampleIR = null;
  const { data: sampleIRData } = await supabase
    .from("ir_presentations")
    .select("id, title, template")
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (sampleIRData) {
    const { data: sampleSlides } = await supabase
      .from("ir_slides")
      .select("slide_type, title, slide_order")
      .eq("presentation_id", sampleIRData.id)
      .order("slide_order");

    if (sampleSlides && sampleSlides.length > 0) {
      sampleIR = {
        title: sampleIRData.title,
        template: sampleIRData.template || "minimal",
        slides: sampleSlides.map((s) => ({
          slide_type: s.slide_type,
          title: s.title,
        })),
      };
    }
  }

  // 사용자의 완성된 사업계획서 확인 (IR 생성 가능 여부)
  const { data: completedPlans } = await supabase
    .from("business_plans")
    .select("id, title")
    .eq("company_id", company.id)
    .eq("status", "completed")
    .order("created_at", { ascending: false });

  return (
    <IRShowcase
      userIRs={userIRs}
      sampleIR={sampleIR}
      completedPlans={completedPlans || []}
    />
  );
}
