"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { FileText, Loader2 } from "lucide-react";

interface CreatePlanButtonProps {
  programId: string;
  programTitle: string;
}

export function CreatePlanButton({ programId, programTitle }: CreatePlanButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 회사 조회
      const { data: companies } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);

      const company = companies?.[0];
      if (!company) {
        router.push("/onboarding");
        return;
      }

      // 이미 같은 프로그램으로 만든 계획서 확인
      const { data: existingPlans } = await supabase
        .from("business_plans")
        .select("id")
        .eq("company_id", company.id)
        .eq("program_id", programId)
        .limit(1);

      if (existingPlans && existingPlans.length > 0) {
        // 기존 계획서로 이동
        router.push(`/plans/${existingPlans[0].id}`);
        return;
      }

      // 새 사업계획서 생성
      const { data: plan, error } = await supabase
        .from("business_plans")
        .insert({
          company_id: company.id,
          program_id: programId,
          title: `${programTitle} - 사업계획서`,
          status: "draft",
        })
        .select()
        .single();

      if (error) throw error;

      // 에디터 페이지로 이동 (생성 시작)
      router.push(`/plans/${plan.id}`);
    } catch (error) {
      console.error("Plan creation error:", error);
      alert("사업계획서 생성에 실패했습니다. 다시 시도해 주세요.");
    }
    setLoading(false);
  };

  return (
    <Button className="w-full gap-2" onClick={handleCreate} disabled={loading}>
      {loading ? (
        <><Loader2 className="h-4 w-4 animate-spin" /> 생성 중...</>
      ) : (
        <><FileText className="h-4 w-4" /> 사업계획서 작성 시작</>
      )}
    </Button>
  );
}
