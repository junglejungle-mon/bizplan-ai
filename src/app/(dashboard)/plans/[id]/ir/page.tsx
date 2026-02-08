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

  // IR 프레젠테이션이 이미 있는지 확인 (최신 1개)
  const { data: presentations } = await supabase
    .from("ir_presentations")
    .select("id, status")
    .eq("plan_id", id)
    .order("created_at", { ascending: false })
    .limit(1);

  const presentation = presentations?.[0] || null;

  // 슬라이드 목록 로드 (프레젠테이션이 있을 경우)
  let slides: Array<{
    id: string;
    slide_order: number;
    slide_type: string;
    title: string;
    content: Record<string, unknown>;
    notes: string | null;
  }> = [];

  if (presentation) {
    const { data: slideData } = await supabase
      .from("ir_slides")
      .select("id, slide_order, slide_type, title, content, notes")
      .eq("presentation_id", presentation.id)
      .order("slide_order");
    slides = (slideData as typeof slides) || [];
  }

  return (
    <IRGeneratorClient
      planId={id}
      planTitle={plan.title}
      hasPresentation={!!presentation}
      slides={slides}
    />
  );
}
