import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ConsultantPageClient } from "@/components/consultant/consultant-page-client";

export default async function ConsultantPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, profile_score")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  // 샘플 계획서 (완성된 것 1개)
  let samplePlan: any = null;
  let sampleIR: any = null;

  const { data: samplePlanData } = await supabase
    .from("business_plans")
    .select("id, title, companies(name)")
    .eq("status", "completed")
    .limit(1);

  if (samplePlanData?.[0]) {
    const { data: sections } = await supabase
      .from("plan_sections")
      .select("section_name, section_order, content")
      .eq("plan_id", samplePlanData[0].id)
      .order("section_order");

    samplePlan = {
      title: samplePlanData[0].title,
      companyName: (samplePlanData[0] as any).companies?.name || "샘플 기업",
      sections: (sections || []).map((s: any) => ({
        section_name: s.section_name,
        content_preview: s.content ? s.content.substring(0, 200) : "",
        section_order: s.section_order,
      })),
    };
  }

  // 샘플 IR (완성된 것 1개)
  const { data: sampleIRData } = await supabase
    .from("ir_presentations")
    .select("id, title, template")
    .eq("status", "completed")
    .limit(1);

  if (sampleIRData?.[0]) {
    const { data: slides } = await supabase
      .from("ir_slides")
      .select("slide_type, title, slide_order")
      .eq("presentation_id", sampleIRData[0].id)
      .order("slide_order");

    sampleIR = {
      title: sampleIRData[0].title,
      template: sampleIRData[0].template,
      slides: (slides || []).map((s: any) => ({
        slide_type: s.slide_type,
        title: s.title,
      })),
    };
  }

  return (
    <ConsultantPageClient
      companyName={company.name}
      profileScore={company.profile_score}
      samplePlan={samplePlan}
      sampleIR={sampleIR}
    />
  );
}
