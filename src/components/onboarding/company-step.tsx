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

          {/* Quick Win 가치 전달 */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-blue-50 p-3">
              <div className="text-2xl mb-1">📝</div>
              <div className="text-xs font-medium text-gray-900">사업계획서</div>
              <div className="text-[10px] text-gray-500">AI 자동 작성</div>
            </div>
            <div className="rounded-lg bg-green-50 p-3">
              <div className="text-2xl mb-1">🎯</div>
              <div className="text-xs font-medium text-gray-900">지원사업 매칭</div>
              <div className="text-[10px] text-gray-500">적합도 자동 분석</div>
            </div>
            <div className="rounded-lg bg-purple-50 p-3">
              <div className="text-2xl mb-1">📊</div>
              <div className="text-xs font-medium text-gray-900">IR PPT</div>
              <div className="text-[10px] text-gray-500">투자자 발표자료</div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-800 flex items-center gap-1.5">
              ⏱️ 10분 인터뷰 → 전문 사업계획서 완성
            </p>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">1</span>
                AI 전략 컨설턴트와 5라운드 인터뷰
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">2</span>
                시장 분석 + 경쟁사 데이터 자동 수집
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">3</span>
                정부지원사업 맞춤 사업계획서 생성
              </li>
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
