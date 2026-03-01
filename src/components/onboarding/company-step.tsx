"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { INTERVIEW_INITIAL_QUESTION } from "@/lib/ai/prompts/interview";
import { Building2, ArrowRight, Loader2, MapPin, Users, Briefcase } from "lucide-react";

// 업종 카테고리
const INDUSTRY_OPTIONS = [
  { value: "", label: "업종 선택 (선택사항)" },
  { value: "IT/소프트웨어", label: "IT/소프트웨어" },
  { value: "제조업", label: "제조업" },
  { value: "바이오/헬스케어", label: "바이오/헬스케어" },
  { value: "유통/물류", label: "유통/물류" },
  { value: "콘텐츠/미디어", label: "콘텐츠/미디어" },
  { value: "교육/에듀테크", label: "교육/에듀테크" },
  { value: "금융/핀테크", label: "금융/핀테크" },
  { value: "식품/외식", label: "식품/외식" },
  { value: "농업/수산업", label: "농업/수산업" },
  { value: "에너지/환경", label: "에너지/환경" },
  { value: "건설/부동산", label: "건설/부동산" },
  { value: "관광/여행", label: "관광/여행" },
  { value: "사회적기업", label: "사회적기업" },
  { value: "기타", label: "기타" },
];

// 지역 옵션
const REGION_OPTIONS = [
  { value: "", label: "지역 선택 (선택사항)" },
  { value: "서울", label: "서울" },
  { value: "경기", label: "경기" },
  { value: "인천", label: "인천" },
  { value: "부산", label: "부산" },
  { value: "대구", label: "대구" },
  { value: "광주", label: "광주" },
  { value: "대전", label: "대전" },
  { value: "울산", label: "울산" },
  { value: "세종", label: "세종" },
  { value: "강원", label: "강원" },
  { value: "충북", label: "충북" },
  { value: "충남", label: "충남" },
  { value: "전북", label: "전북" },
  { value: "전남", label: "전남" },
  { value: "경북", label: "경북" },
  { value: "경남", label: "경남" },
  { value: "제주", label: "제주" },
];

// 직원수 옵션 (value는 DB integer 컬럼에 맞게 대표 숫자)
const EMPLOYEE_OPTIONS = [
  { value: "", label: "직원수 선택 (선택사항)" },
  { value: "1", label: "1인 (대표만)" },
  { value: "3", label: "2~5명" },
  { value: "8", label: "6~10명" },
  { value: "30", label: "11~50명" },
  { value: "75", label: "51~100명" },
  { value: "150", label: "100명 이상" },
];

interface CompanyStepProps {
  onComplete: (companyId: string) => void;
  defaultCompanyName?: string;
}

export function CompanyStep({ onComplete, defaultCompanyName = "" }: CompanyStepProps) {
  const [companyName, setCompanyName] = useState(defaultCompanyName);
  const [industry, setIndustry] = useState("");
  const [region, setRegion] = useState("");
  const [employeeCount, setEmployeeCount] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showError, setShowError] = useState(false);
  const router = useRouter();

  // 기존 회사 데이터 로드 (프리필)
  useEffect(() => {
    const loadExistingCompany = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setInitialLoading(false);
          return;
        }

        const { data: companies } = await supabase
          .from("companies")
          .select("name, industry, region, employee_count")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1);

        if (companies && companies.length > 0) {
          const company = companies[0];
          if (company.name) setCompanyName(company.name);
          if (company.industry) setIndustry(company.industry);
          if (company.region) setRegion(company.region);
          if (company.employee_count) setEmployeeCount(String(company.employee_count));
        }
      } catch (err) {
        console.error("[CompanyStep] 기존 회사 로드 오류:", err);
      }
      setInitialLoading(false);
    };

    loadExistingCompany();
  }, []);

  // defaultCompanyName이 비동기로 변경될 때 반영
  useEffect(() => {
    if (defaultCompanyName && !companyName) {
      setCompanyName(defaultCompanyName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCompanyName]);

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim()) {
      setShowError(true);
      return;
    }
    setShowError(false);

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
      // 기존 회사가 있으면 이름 + 업종/지역/직원수 업데이트하고 재사용
      companyId = existingCompanies[0].id;
      await supabase
        .from("companies")
        .update({
          name: companyName,
          ...(industry && { industry }),
          ...(region && { region }),
          ...(employeeCount && { employee_count: parseInt(employeeCount, 10) }),
          updated_at: new Date().toISOString(),
        })
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
          ...(industry && { industry }),
          ...(region && { region }),
          ...(employeeCount && { employee_count: parseInt(employeeCount, 10) }),
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

  if (initialLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <p className="mt-3 text-sm text-gray-500">회사 정보 확인 중...</p>
        </div>
      </div>
    );
  }

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
          <div>
            <Input
              id="companyName"
              label="회사명 (사업자명)"
              placeholder="예: 주식회사 정글몬스터"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                if (e.target.value.trim()) setShowError(false);
              }}
              required
              autoFocus
              className={showError ? "border-red-500 ring-1 ring-red-500" : ""}
            />
            {showError && (
              <p className="mt-1.5 text-xs text-red-500">회사명을 입력해주세요</p>
            )}
          </div>

          {/* 간편 프로필: 업종/지역/직원수 */}
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label htmlFor="industry" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                업종
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
              >
                {INDUSTRY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="region" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-green-500" />
                  지역
                </label>
                <select
                  id="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {REGION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="employees" className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1">
                  <Users className="h-3.5 w-3.5 text-purple-500" />
                  직원수
                </label>
                <select
                  id="employees"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-700 bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  {EMPLOYEE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

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
