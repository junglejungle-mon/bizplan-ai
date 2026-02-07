"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  MessageSquare,
  Save,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  business_content: string;
  industry: string | null;
  region: string | null;
  employee_count: number | null;
  revenue: string | null;
  established_date: string | null;
  profile_score: number;
}

interface Interview {
  id: string;
  question: string;
  answer: string | null;
  category: string;
  round: number;
  created_at: string;
}

export default function CompanyPage() {
  const [company, setCompany] = useState<CompanyData | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInterviews, setShowInterviews] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: companies } = await supabase
      .from("companies")
      .select("*")
      .eq("user_id", user.id)
      .limit(1);

    if (!companies?.[0]) {
      router.push("/onboarding");
      return;
    }

    setCompany(companies[0]);

    const { data: interviewData } = await supabase
      .from("company_interviews")
      .select("*")
      .eq("company_id", companies[0].id)
      .order("question_order", { ascending: true });

    setInterviews(interviewData ?? []);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);

    const supabase = createClient();
    await supabase
      .from("companies")
      .update({
        name: company.name,
        industry: company.industry,
        region: company.region,
        employee_count: company.employee_count,
        revenue: company.revenue,
        established_date: company.established_date,
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!company) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">회사 정보</h1>
          <p className="text-gray-500">프로필을 고도화하면 매칭 품질이 향상됩니다</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={company.profile_score >= 70 ? "success" : company.profile_score >= 30 ? "warning" : "destructive"}>
            프로필 {company.profile_score}%
          </Badge>
        </div>
      </div>

      {/* 프로필 완성도 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">프로필 완성도</span>
            <span className="text-sm font-bold text-blue-600">{company.profile_score}%</span>
          </div>
          <div className="h-3 rounded-full bg-gray-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all"
              style={{ width: `${company.profile_score}%` }}
            />
          </div>
          {company.profile_score < 70 && (
            <p className="mt-2 text-xs text-gray-500">
              추가 인터뷰를 통해 프로필을 고도화할 수 있습니다
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 기본 정보 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              기본 정보
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="회사명"
              value={company.name}
              onChange={(e) => setCompany({ ...company, name: e.target.value })}
            />
            <Input
              label="업종"
              placeholder="예: IT/소프트웨어, 제조업"
              value={company.industry ?? ""}
              onChange={(e) => setCompany({ ...company, industry: e.target.value })}
            />
            <Input
              label="지역"
              placeholder="서울, 경기"
              value={company.region ?? ""}
              onChange={(e) => setCompany({ ...company, region: e.target.value })}
            />
            <Input
              label="직원 수"
              type="number"
              placeholder="10"
              value={company.employee_count?.toString() ?? ""}
              onChange={(e) =>
                setCompany({
                  ...company,
                  employee_count: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
            <Input
              label="연매출"
              placeholder="예: 5억원"
              value={company.revenue ?? ""}
              onChange={(e) => setCompany({ ...company, revenue: e.target.value })}
            />
            <Input
              label="설립일"
              type="date"
              value={company.established_date ?? ""}
              onChange={(e) =>
                setCompany({ ...company, established_date: e.target.value })
              }
            />
            <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> 저장 중...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" /> 저장
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 사업 내용 (AI 요약) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-600" />
              AI 인터뷰 기반 사업 프로필
            </CardTitle>
          </CardHeader>
          <CardContent>
            {company.business_content ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {company.business_content}
              </p>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">
                  AI 인터뷰를 통해 사업 프로필이 생성됩니다
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => router.push("/onboarding")}
                >
                  AI 인터뷰 시작
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 인터뷰 기록 */}
      {interviews.length > 0 && (
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() => setShowInterviews(!showInterviews)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                인터뷰 기록 ({interviews.filter((i) => i.answer).length}개 답변)
              </CardTitle>
              {showInterviews ? (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              ) : (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </CardHeader>
          {showInterviews && (
            <CardContent className="space-y-4">
              {interviews.map((interview) => (
                <div key={interview.id} className="border-l-2 border-blue-200 pl-4">
                  <p className="text-sm font-medium text-gray-800">
                    Q: {interview.question}
                  </p>
                  {interview.answer ? (
                    <p className="mt-1 text-sm text-gray-600">
                      A: {interview.answer}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400 italic">
                      미답변
                    </p>
                  )}
                  <Badge variant="outline" className="mt-1 text-xs">
                    Round {interview.round} · {interview.category}
                  </Badge>
                </div>
              ))}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
