import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { PlansEmptyState } from "@/components/plans/plans-empty-state";
import { PlanExampleCards } from "@/components/plans/plan-example-cards";

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  const previewMode = sp.preview === "1";

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

  const { data: plans } = await supabase
    .from("business_plans")
    .select("*, programs(title)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  const showEmpty = previewMode || !plans || plans.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사업계획서</h1>
          <p className="text-gray-500">AI가 작성한 사업계획서 목록</p>
        </div>
      </div>

      {!showEmpty && plans && plans.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: { id: string; title: string; status: string; created_at: string; programs?: { title?: string } | null }) => (
            <Link key={plan.id} href={`/plans/${plan.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <Badge
                      variant={
                        plan.status === "completed"
                          ? "success"
                          : plan.status === "generating"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {plan.status === "completed"
                        ? "완성"
                        : plan.status === "generating"
                        ? "생성 중"
                        : "초안"}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {plan.title}
                  </h3>
                  {plan.programs?.title && (
                    <p className="text-xs text-gray-400">{plan.programs.title}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(plan.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* 사업계획서 예시 — 클릭하면 실제 내용 펼쳐보기 */}
          <PlanExampleCards />

          <PlansEmptyState samplePlan={null} sampleIR={null} />
        </div>
      )}
    </div>
  );
}
