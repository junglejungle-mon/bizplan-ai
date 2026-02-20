"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Presentation,
  ArrowRight,
  Palette,
  Download,
  Sparkles,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { IRExampleCards } from "./ir-example-cards";

const TEMPLATES = [
  { key: "minimal", label: "미니멀", desc: "깔끔한 네이비 & 블루", colors: ["#1A1A2E", "#023793", "#4361EE"] },
  { key: "tech", label: "테크", desc: "다크 배경 + 블루 액센트", colors: ["#0D1117", "#58A6FF", "#7EE787"] },
  { key: "classic", label: "클래식", desc: "네이비 & 레드 포인트", colors: ["#2C3E50", "#003366", "#E74C3C"] },
  { key: "professional", label: "프로페셔널", desc: "틸블루 & 골드 고급", colors: ["#0F2B46", "#1B4F72", "#D4A843"] },
  { key: "vibrant", label: "바이브런트", desc: "퍼플 & 코랄 스타트업", colors: ["#2D1B69", "#6C3CE0", "#FF6B6B"] },
];

const PROCESS_STEPS = [
  {
    step: 1,
    title: "사업계획서 완성",
    desc: "AI가 자동 작성한 사업계획서를 확인합니다",
    icon: FileText,
    color: "blue",
    href: "/plans",
  },
  {
    step: 2,
    title: "템플릿 선택",
    desc: "5가지 디자인 중 원하는 스타일을 선택합니다",
    icon: Palette,
    color: "purple",
    href: null,
  },
  {
    step: 3,
    title: "PPTX 다운로드",
    desc: "10~15장의 IR PPT가 자동 생성됩니다",
    icon: Download,
    color: "green",
    href: null,
  },
];

interface IRShowcaseProps {
  userIRs: {
    id: string;
    plan_id: string;
    title: string;
    template: string;
    status: string;
    created_at: string;
    business_plans: { title: string } | null;
  }[];
  sampleIR: {
    title: string;
    template: string;
    slides: { slide_type: string; title: string }[];
  } | null;
  completedPlans: { id: string; title: string }[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- sampleIR reserved for sample preview feature
export function IRShowcase({ userIRs, sampleIR: _sampleIR, completedPlans }: IRShowcaseProps) {
  const hasPlans = completedPlans.length > 0;
  const hasIRs = userIRs.length > 0;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">IR PPT</h1>
          <p className="text-gray-500">사업계획서 기반 투자유치 프레젠테이션</p>
        </div>
        {hasPlans && (
          <Link href={`/plans/${completedPlans[0].id}/ir`}>
            <Button className="gap-2">
              IR PPT 만들기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        )}
      </div>

      {/* 사용자의 기존 IR 목록 */}
      {hasIRs && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {userIRs.map((ir) => (
            <Link key={ir.id} href={`/plans/${ir.plan_id}/ir`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Presentation className="h-5 w-5 text-purple-500" />
                    <Badge
                      variant={
                        ir.status === "completed"
                          ? "success"
                          : ir.status === "generating"
                          ? "warning"
                          : "secondary"
                      }
                    >
                      {ir.status === "completed"
                        ? "완성"
                        : ir.status === "generating"
                        ? "생성 중"
                        : "초안"}
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 line-clamp-2 mb-2">
                    {ir.title}
                  </h3>
                  {ir.business_plans?.title && (
                    <p className="text-xs text-gray-400">{ir.business_plans.title}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(ir.created_at).toLocaleDateString("ko-KR")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* 쇼케이스 — IR 없을 때 or 항상 하단에 표시 */}
      {!hasIRs && (
        <>
          {/* 메인 소개 카드 */}
          <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-100 mb-4">
                <Presentation className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-purple-900">
                AI가 투자유치 PPT를 자동으로 만들어드립니다
              </h3>
              <p className="mt-2 text-sm text-purple-700 text-center max-w-md">
                사업계획서를 기반으로 10~15장의 투자유치 프레젠테이션이 자동 생성됩니다.
                로고를 업로드하면 CI 색상도 자동 추출합니다.
              </p>
              {hasPlans ? (
                <Link href={`/plans/${completedPlans[0].id}/ir`} className="mt-6">
                  <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
                    IR PPT 만들기 <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              ) : (
                <Link href="/programs" className="mt-6">
                  <Button className="gap-2">
                    사업계획서 먼저 만들기 <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* 디자인 템플릿 갤러리 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-purple-600" />
              <h2 className="text-lg font-bold text-gray-900">디자인 템플릿</h2>
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">
                5종
              </Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {TEMPLATES.map((t) => (
                <Card key={t.key} className="hover:shadow-sm transition-shadow">
                  <CardContent className="p-4 text-center">
                    {/* 색상 미리보기 */}
                    <div className="flex gap-1 justify-center mb-3">
                      {t.colors.map((color, i) => (
                        <div
                          key={i}
                          className="h-8 w-8 rounded-lg shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400 justify-center">
              <Sparkles className="h-3.5 w-3.5" />
              <span>로고 업로드 시 CI 색상을 자동 추출하여 커스텀 템플릿도 지원합니다</span>
            </div>
          </div>

          {/* 예시 IR PPT — 클릭하면 실제 결과물 모양으로 보여주기 */}
          <IRExampleCards />

          {/* 생성 과정 3단계 */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <h2 className="text-lg font-bold text-gray-900">생성 과정</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {PROCESS_STEPS.map((step) => {
                const colorMap: Record<string, { bg: string; icon: string; badge: string }> = {
                  blue: { bg: "bg-blue-50", icon: "text-blue-600", badge: "bg-blue-100 text-blue-700" },
                  purple: { bg: "bg-purple-50", icon: "text-purple-600", badge: "bg-purple-100 text-purple-700" },
                  green: { bg: "bg-green-50", icon: "text-green-600", badge: "bg-green-100 text-green-700" },
                };
                const c = colorMap[step.color];

                return (
                  <Card key={step.step} className="relative">
                    <CardContent className="p-5">
                      <Badge className={`${c.badge} hover:${c.badge} text-xs mb-3`}>
                        Step {step.step}
                      </Badge>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} mb-3`}>
                        <step.icon className={`h-5 w-5 ${c.icon}`} />
                      </div>
                      <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
                      <p className="text-xs text-gray-500 mt-1">{step.desc}</p>
                      {step.href && (
                        <Link href={step.href} className="mt-3 inline-block">
                          <span className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                            바로가기 <ArrowRight className="h-3 w-3" />
                          </span>
                        </Link>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
