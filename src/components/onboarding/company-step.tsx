"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { INTERVIEW_INITIAL_QUESTION } from "@/lib/ai/prompts/interview";
import { Building2, ArrowRight, Loader2 } from "lucide-react";

interface CompanyStepProps {
  onComplete: (companyId: string) => void;
}

export function CompanyStep({ onComplete }: CompanyStepProps) {
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) return;

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    // 기존 회사가 있는지 확인 (중복 생성 방지)
    const { data: existingCompanies } = await supabase
      .from("companies")
      .select("id, name")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1);

    let companyId: string;

    if (existingCompanies && existingCompanies.length > 0) {
      // 기존 회사가 있으면 이름만 업데이트하고 재사용
      companyId = existingCompanies[0].id;
      await supabase
        .from("companies")
        .update({ name: companyName, updated_at: new Date().toISOString() })
        .eq("id", companyId);
    } else {
      // 회사가 없을 때만 새로 생성
      const { data, error } = await supabase
        .from("companies")
        .insert({
          user_id: user.id,
          name: companyName,
          business_content: "",
          profile_score: 0,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating company:", error);
        setLoading(false);
        return;
      }
      companyId = data.id;
    }

    // 기존 인터뷰 데이터가 없을 때만 초기 질문 저장
    const { data: existingQA } = await supabase
      .from("company_interviews")
      .select("id")
      .eq("company_id", companyId)
      .limit(1);

    if (!existingQA || existingQA.length === 0) {
      await supabase.from("company_interviews").insert({
        company_id: companyId,
        question: INTERVIEW_INITIAL_QUESTION,
        category: "basic",
        question_order: 0,
        round: 1,
      });
    }

    setLoading(false);
    onComplete(companyId);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 mb-4">
            <Building2 className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">회사 정보 입력</h1>
          <p className="mt-2 text-gray-500">
            AI 전략 컨설턴트가 사업을 분석하고, 정부지원사업에 최적화된 프로필을 구축합니다
          </p>
        </div>

        <form onSubmit={handleCreateCompany} className="space-y-6">
          <Input
            id="companyName"
            label="회사명 (사업자명)"
            placeholder="주식회사 정글몬스터"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            required
          />

          <div className="rounded-lg bg-blue-50 p-4 space-y-2">
            <p className="text-xs font-medium text-blue-800">AI 인터뷰 안내</p>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• 5라운드, 약 15~20개 질문 (10분 소요)</li>
              <li>• 시장 트렌드 기반 전략 컨설팅 + 데이터 수집</li>
              <li>• 인터뷰 완료 후 AI가 사업계획서를 자동 작성합니다</li>
            </ul>
          </div>

          <Button type="submit" className="w-full gap-2" size="lg" disabled={loading}>
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> 생성 중...</>
            ) : (
              <>AI 전략 인터뷰 시작하기 <ArrowRight className="h-4 w-4" /></>
            )}
          </Button>
        </form>
      </Card>
    </div>
  );
}
