"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ArrowRight,
  BarChart3,
  PieChart,
  TrendingUp,
  Target,
  Clock,
  DollarSign,
  Building2,
  GitCompare,
  Eye,
  Sparkles,
} from "lucide-react";
import { SamplePreview } from "@/components/dashboard/sample-preview";

interface PlansEmptyStateProps {
  samplePlan: {
    title: string;
    companyName: string;
    sections: { section_name: string; content_preview: string; section_order: number }[];
  } | null;
  sampleIR: {
    title: string;
    template: string;
    slides: { slide_type: string; title: string }[];
  } | null;
}

const CHART_TYPES = [
  { icon: BarChart3, label: "막대 그래프", desc: "시장 규모, 매출 비교", color: "blue" },
  { icon: PieChart, label: "파이 차트", desc: "점유율, 비중 분석", color: "green" },
  { icon: TrendingUp, label: "꺾은선 차트", desc: "성장 추이, 트렌드", color: "purple" },
  { icon: Target, label: "TAM/SAM/SOM", desc: "시장 기회 분석", color: "red" },
  { icon: Clock, label: "타임라인", desc: "로드맵, 마일스톤", color: "orange" },
  { icon: DollarSign, label: "매출 모델", desc: "수익 구조 시각화", color: "emerald" },
  { icon: Building2, label: "조직 구조", desc: "팀 구성, 역할", color: "indigo" },
  { icon: GitCompare, label: "비교 테이블", desc: "경쟁사 비교 분석", color: "pink" },
];

export function PlansEmptyState({ samplePlan, sampleIR }: PlansEmptyStateProps) {
  return (
    <div className="space-y-6">
      {/* 기본 안내 */}
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FileText className="h-12 w-12 text-gray-300 mb-4" />
          <h3 className="font-semibold text-gray-900">
            아직 작성된 사업계획서가 없습니다
          </h3>
          <p className="mt-2 text-sm text-gray-500 text-center">
            지원사업을 선택하면 AI가 자동으로 사업계획서를 작성합니다
          </p>
          <Link href="/programs" className="mt-6">
            <Button className="gap-2">
              지원사업 둘러보기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* 예시 계획서 미리보기 */}
      {(samplePlan || sampleIR) && (
        <SamplePreview samplePlan={samplePlan} sampleIR={sampleIR} />
      )}

      {/* 인포그래픽 갤러리 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-bold text-gray-900">
            인포그래픽도 자동 생성됩니다
          </h2>
          <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
            AI 자동 삽입
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {CHART_TYPES.map((chart) => {
            const colorMap: Record<string, { bg: string; icon: string; text: string }> = {
              blue: { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-700" },
              green: { bg: "bg-green-50", icon: "text-green-600", text: "text-green-700" },
              purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-700" },
              red: { bg: "bg-red-50", icon: "text-red-600", text: "text-red-700" },
              orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-700" },
              emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-700" },
              indigo: { bg: "bg-indigo-50", icon: "text-indigo-600", text: "text-indigo-700" },
              pink: { bg: "bg-pink-50", icon: "text-pink-600", text: "text-pink-700" },
            };
            const c = colorMap[chart.color];
            return (
              <Card key={chart.label} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-4 text-center">
                  <div className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl ${c.bg} mb-2`}>
                    <chart.icon className={`h-5 w-5 ${c.icon}`} />
                  </div>
                  <p className={`text-xs font-semibold ${c.text}`}>{chart.label}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{chart.desc}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">
          사업계획서 내용에 맞는 차트와 인포그래픽이 자동으로 삽입됩니다
        </p>
      </div>

      {/* CTA */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-100">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="font-semibold text-purple-900">AI가 자동으로 작성합니다</p>
              <p className="text-sm text-purple-700">
                지원사업을 선택하면 양식에 맞춰 8~12개 섹션이 자동 작성됩니다
              </p>
            </div>
          </div>
          <Link href="/programs">
            <Button className="gap-2 bg-purple-600 hover:bg-purple-700">
              시작하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
