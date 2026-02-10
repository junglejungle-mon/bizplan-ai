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
  Upload,
  FileText,
  CheckCircle2,
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResult, setOcrResult] = useState<any>(null);
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

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("autoSave", "false"); // 사용자 확인 후 저장

      const res = await fetch("/api/company/ocr-registration", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "OCR 실패");
        return;
      }

      const result = await res.json();
      setOcrResult(result.data);

      // 추출된 정보를 폼에 자동 채움
      if (company && result.data) {
        const d = result.data;
        setCompany({
          ...company,
          ...(d.company_name && { name: d.company_name }),
          ...(d.industry && { industry: d.industry }),
          ...(d.region && { region: d.region }),
          ...(d.established_date && { established_date: d.established_date }),
        });
      }
    } catch {
      alert("OCR 처리 중 오류가 발생했습니다");
    } finally {
      setOcrLoading(false);
      // input 초기화
      e.target.value = "";
    }
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

      {/* 사업자등록증 OCR */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <FileText className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">사업자등록증 자동 입력</h3>
              <p className="text-xs text-gray-500">사업자등록증을 업로드하면 회사 정보가 자동으로 채워집니다</p>
            </div>
          </div>
          <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
            ocrLoading ? "border-blue-300 bg-blue-50" : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
          }`}>
            {ocrLoading ? (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span className="text-sm font-medium">사업자등록증 분석 중...</span>
              </div>
            ) : ocrResult ? (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-medium">
                  {ocrResult.company_name || "정보"} 추출 완료 (신뢰도 {Math.round((ocrResult.confidence || 0) * 100)}%)
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <Upload className="h-6 w-6" />
                <span className="text-xs">사업자등록증 이미지 또는 PDF</span>
                <span className="text-[10px]">JPG, PNG, PDF (10MB 이하)</span>
              </div>
            )}
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleOcrUpload}
              disabled={ocrLoading}
            />
          </label>
          {ocrResult && (
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {ocrResult.business_number && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">사업자번호</span>
                  <div className="font-mono font-medium text-gray-800">{ocrResult.business_number}</div>
                </div>
              )}
              {ocrResult.representative && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">대표자</span>
                  <div className="font-medium text-gray-800">{ocrResult.representative}</div>
                </div>
              )}
              {ocrResult.business_type && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">종목</span>
                  <div className="font-medium text-gray-800">{ocrResult.business_type}</div>
                </div>
              )}
              {ocrResult.address && (
                <div className="bg-gray-50 rounded-lg px-3 py-2">
                  <span className="text-gray-500">소재지</span>
                  <div className="font-medium text-gray-800 truncate">{ocrResult.address}</div>
                </div>
              )}
            </div>
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
