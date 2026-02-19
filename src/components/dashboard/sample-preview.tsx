"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Presentation,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Download,
  Sparkles,
  Eye,
} from "lucide-react";

const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "표지",
  problem: "문제 정의",
  solution: "솔루션",
  market: "시장 분석",
  business_model: "비즈니스 모델",
  traction: "성과/트랙션",
  competition: "경쟁 분석",
  tech: "기술 설명",
  team: "팀 소개",
  financials: "재무 계획",
  ask: "투자 요청",
  roadmap: "로드맵",
};

interface SamplePreviewProps {
  samplePlan: {
    title: string;
    companyName: string;
    sections: {
      section_name: string;
      content_preview: string;
      section_order: number;
    }[];
  } | null;
  sampleIR: {
    title: string;
    template: string;
    slides: { slide_type: string; title: string }[];
  } | null;
}

export function SamplePreview({ samplePlan, sampleIR }: SamplePreviewProps) {
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [showAllSlides, setShowAllSlides] = useState(false);

  if (!samplePlan && !sampleIR) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Eye className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-bold text-gray-900">
          이렇게 만들어집니다
        </h2>
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">
          실제 결과물 미리보기
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 사업계획서 예시 */}
        {samplePlan && (
          <Card className="border-purple-200 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-purple-50 to-indigo-50 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold text-purple-900">
                    AI 사업계획서 예시
                  </CardTitle>
                  <p className="text-xs text-purple-600">
                    {samplePlan.companyName}
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700 text-[10px]"
                >
                  완성
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                {samplePlan.sections.length}개 섹션 자동 작성 완료
              </p>

              {samplePlan.sections.map((section) => (
                <div
                  key={section.section_order}
                  className="border border-gray-100 rounded-lg overflow-hidden"
                >
                  <button
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                    onClick={() =>
                      setExpandedSection(
                        expandedSection === section.section_order
                          ? null
                          : section.section_order
                      )
                    }
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-purple-100 text-[10px] font-bold text-purple-700 flex-shrink-0">
                      {section.section_order}
                    </span>
                    <span className="text-xs font-medium text-gray-700 flex-1">
                      {section.section_name}
                    </span>
                    {expandedSection === section.section_order ? (
                      <ChevronUp className="h-3 w-3 text-gray-400" />
                    ) : (
                      <ChevronDown className="h-3 w-3 text-gray-400" />
                    )}
                  </button>
                  {expandedSection === section.section_order && (
                    <div className="px-3 pb-3 border-t border-gray-50">
                      <p className="text-xs text-gray-500 leading-relaxed mt-2 whitespace-pre-wrap">
                        {section.content_preview}
                        {section.content_preview.length >= 200 && "..."}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex items-center gap-2 pt-3 text-[10px] text-gray-400">
                <Download className="h-3 w-3" />
                DOCX / PDF / HWPX 다운로드 지원
              </div>

              <Link href="/programs">
                <Button
                  size="sm"
                  className="w-full gap-2 mt-2 bg-purple-600 hover:bg-purple-700"
                >
                  <Sparkles className="h-3 w-3" />
                  나도 사업계획서 만들기
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* IR PPT 예시 */}
        {sampleIR && (
          <Card className="border-orange-200 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-orange-50 to-amber-50 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-100">
                  <Presentation className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-sm font-semibold text-orange-900">
                    IR PPT 예시
                  </CardTitle>
                  <p className="text-xs text-orange-600">
                    {sampleIR.template} 템플릿
                  </p>
                </div>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-700 text-[10px]"
                >
                  {sampleIR.slides.length}장
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-2">
              <p className="text-xs text-gray-500 mb-3">
                사업계획서 기반 IR PPT 자동 생성
              </p>

              <div className="space-y-1.5">
                {(showAllSlides
                  ? sampleIR.slides
                  : sampleIR.slides.slice(0, 6)
                ).map((slide, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-orange-100 text-[10px] font-bold text-orange-700 flex-shrink-0">
                      {i + 1}
                    </span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] bg-orange-50 text-orange-600"
                    >
                      {SLIDE_TYPE_LABELS[slide.slide_type] || slide.slide_type}
                    </Badge>
                    <span className="text-xs text-gray-600 truncate flex-1">
                      {slide.title}
                    </span>
                  </div>
                ))}
                {!showAllSlides && sampleIR.slides.length > 6 && (
                  <button
                    onClick={() => setShowAllSlides(true)}
                    className="w-full text-xs text-orange-600 hover:text-orange-700 py-1"
                  >
                    +{sampleIR.slides.length - 6}장 더 보기
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 pt-3 text-[10px] text-gray-400">
                <Download className="h-3 w-3" />
                PPTX 다운로드 지원
              </div>

              <Link href="/programs">
                <Button
                  size="sm"
                  className="w-full gap-2 mt-2 bg-orange-600 hover:bg-orange-700"
                >
                  <Sparkles className="h-3 w-3" />
                  나도 IR PPT 만들기
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
