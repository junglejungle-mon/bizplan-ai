import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, ArrowRight } from "lucide-react";

export default async function PlansPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: companies } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  const company = companies?.[0];
  if (!company) redirect("/onboarding");

  const { data: plans } = await supabase
    .from("business_plans")
    .select("*, programs(title)")
    .eq("company_id", company.id)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">사업계획서</h1>
          <p className="text-gray-500">AI가 작성한 사업계획서 목록</p>
        </div>
      </div>

      {plans && plans.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan: any) => (
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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="font-semibold text-gray-900">
              아직 작성된 사업계획서가 없습니다
            </h3>
            <p className="mt-2 text-sm text-gray-500 text-center">
              지원사업을 선택하면 AI가 자동으로 사업계획서를 작성합니다.
            </p>
            <Link href="/programs" className="mt-6">
              <Button className="gap-2">
                지원사업 둘러보기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
