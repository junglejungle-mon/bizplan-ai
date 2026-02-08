import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { IRGeneratorClient } from "@/components/ir/ir-generator-client";

export default async function IREditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: plan } = await supabase
    .from("business_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (!plan) notFound();

  // IR 프레젠테이션이 이미 있는지 확인
  const { data: presentation } = await supabase
    .from("ir_presentations")
    .select("id")
    .eq("plan_id", id)
    .limit(1)
    .maybeSingle();

  return (
    <IRGeneratorClient
      planId={id}
      planTitle={plan.title}
      hasPresentation={!!presentation}
    />
  );
}
