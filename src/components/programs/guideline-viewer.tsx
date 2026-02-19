"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Loader2,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  ListChecks,
  Scale,
} from "lucide-react";

interface GuidelineSection {
  order: number;
  name: string;
  sub_sections?: string[];
  guidelines?: string;
  max_pages?: number | null;
  evaluation_weight: number;
  required_contents?: string[];
  evaluation_criteria?: string;
}

interface EvaluationItem {
  item: string;
  weight: number;
  description?: string;
}

interface EvaluationCategory {
  category: string;
  items: EvaluationItem[];
}

interface GuidelineStructure {
  program_type?: string;
  sections: GuidelineSection[];
  evaluation_table?: EvaluationCategory[];
  total_pages?: number | null;
  submission_format?: string;
  key_requirements?: string[];
  bonus_criteria?: string[];
  disqualification_criteria?: string[];
}

interface GuidelineViewerProps {
  programId: string;
  hasAttachment: boolean;
}

export function GuidelineViewer({
  programId,
  hasAttachment,
}: GuidelineViewerProps) {
  const [structure, setStructure] = useState<GuidelineStructure | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedSection, setExpandedSection] = useState<number | null>(null);
  const [showEvaluation, setShowEvaluation] = useState(false);

  // 초기 로드 — 이미 추출된 구조가 있는지 확인
  useEffect(() => {
    if (!hasAttachment) return;

    fetch(`/api/programs/${programId}/extract-guideline`)
      .then((res) => res.json())
      .then((data) => {
        if (data.extracted && data.structure) {
          setStructure(data.structure);
        }
      })
      .catch(() => {});
  }, [programId, hasAttachment]);

  const handleExtract = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/programs/${programId}/extract-guideline`,
        { method: "POST" }
      );
      const data = await res.json();

      if (data.success && data.structure) {
        setStructure(data.structure);
      } else {
        setError(data.error || "추출 실패");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    }

    setLoading(false);
  };

  if (!hasAttachment) {
    return null;
  }

  // 아직 추출 안 됨 → 추출 버튼 표시
  if (!structure) {
    return (
      <Card className="border-indigo-200">
        <CardContent className="p-4 text-center">
          <FileSearch className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-indigo-900 mb-1">
            공고 지침서 분석
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            AI가 공고 양식을 분석하여 섹션 구조와 평가 기준을 추출합니다
          </p>
          {error && (
            <div className="flex items-center gap-1 text-xs text-red-600 mb-2">
              <AlertCircle className="h-3 w-3" />
              {error}
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50"
            onClick={handleExtract}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                분석 중... (30초 소요)
              </>
            ) : (
              <>
                <BookOpen className="h-3 w-3" />
                지침서 구조 추출
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 추출 완료 → 구조 표시
  return (
    <Card className="border-indigo-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-indigo-600" />
            지침서 구조
          </CardTitle>
          <div className="flex items-center gap-1.5">
            {structure.program_type && (
              <Badge className="bg-indigo-50 text-indigo-700 text-[10px]">
                {structure.program_type}
              </Badge>
            )}
            {structure.submission_format && (
              <Badge variant="outline" className="text-[10px]">
                {structure.submission_format}
              </Badge>
            )}
            {structure.total_pages && (
              <Badge variant="secondary" className="text-[10px]">
                {structure.total_pages}p
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 섹션 목록 */}
        <div className="space-y-1.5">
          {structure.sections.map((section) => (
            <div
              key={section.order}
              className="border border-gray-100 rounded-lg overflow-hidden"
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-gray-50 transition-colors"
                onClick={() =>
                  setExpandedSection(
                    expandedSection === section.order
                      ? null
                      : section.order
                  )
                }
              >
                <span className="flex h-5 w-5 items-center justify-center rounded bg-indigo-100 text-[10px] font-bold text-indigo-700 flex-shrink-0">
                  {section.order}
                </span>
                <span className="text-xs font-medium text-gray-700 flex-1 truncate">
                  {section.name}
                </span>
                {section.evaluation_weight > 0 && (
                  <Badge
                    variant="secondary"
                    className="text-[9px] bg-orange-50 text-orange-600 ml-auto mr-1"
                  >
                    {section.evaluation_weight}점
                  </Badge>
                )}
                {expandedSection === section.order ? (
                  <ChevronUp className="h-3 w-3 text-gray-400" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                )}
              </button>

              {expandedSection === section.order && (
                <div className="px-3 pb-3 border-t border-gray-50 space-y-2 mt-1">
                  {section.guidelines && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                        작성 지침
                      </p>
                      <p className="text-xs text-gray-600 whitespace-pre-wrap">
                        {section.guidelines}
                      </p>
                    </div>
                  )}
                  {section.sub_sections &&
                    section.sub_sections.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                          하위 섹션
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {section.sub_sections.map((sub, i) => (
                            <Badge
                              key={i}
                              variant="secondary"
                              className="text-[9px]"
                            >
                              {sub}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  {section.required_contents &&
                    section.required_contents.length > 0 && (
                      <div>
                        <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                          필수 포함 내용
                        </p>
                        <ul className="text-xs text-gray-600 list-disc pl-4 space-y-0.5">
                          {section.required_contents.map((rc, i) => (
                            <li key={i}>{rc}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  {section.evaluation_criteria && (
                    <div>
                      <p className="text-[10px] font-medium text-gray-500 mb-0.5">
                        평가 기준
                      </p>
                      <p className="text-xs text-gray-600">
                        {section.evaluation_criteria}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 평가 기준 테이블 */}
        {structure.evaluation_table &&
          structure.evaluation_table.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-xs text-indigo-600 hover:text-indigo-700 font-medium py-1"
                onClick={() => setShowEvaluation(!showEvaluation)}
              >
                <Scale className="h-3 w-3" />
                평가 기준표 {showEvaluation ? "접기" : "보기"}
                {showEvaluation ? (
                  <ChevronUp className="h-3 w-3" />
                ) : (
                  <ChevronDown className="h-3 w-3" />
                )}
              </button>

              {showEvaluation && (
                <div className="mt-2 space-y-2">
                  {structure.evaluation_table.map((cat, ci) => (
                    <div key={ci} className="bg-gray-50 rounded-lg p-2.5">
                      <p className="text-[10px] font-bold text-gray-700 mb-1.5">
                        {cat.category}
                      </p>
                      <div className="space-y-1">
                        {cat.items.map((item, ii) => (
                          <div
                            key={ii}
                            className="flex items-center gap-2 text-xs"
                          >
                            <span className="flex-1 text-gray-600">
                              {item.item}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[9px] bg-orange-50 text-orange-700"
                            >
                              {item.weight}점
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        {/* 핵심 요구사항 */}
        {structure.key_requirements &&
          structure.key_requirements.length > 0 && (
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-[10px] font-bold text-blue-700 mb-1.5 flex items-center gap-1">
                <ListChecks className="h-3 w-3" />
                핵심 요구사항
              </p>
              <ul className="text-xs text-blue-800 list-disc pl-4 space-y-0.5">
                {structure.key_requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))}
              </ul>
            </div>
          )}

        {/* 가산점 */}
        {structure.bonus_criteria &&
          structure.bonus_criteria.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {structure.bonus_criteria.map((bonus, i) => (
                <Badge
                  key={i}
                  className="bg-green-50 text-green-700 text-[10px]"
                >
                  <CheckCircle2 className="h-3 w-3 mr-0.5" />
                  {bonus}
                </Badge>
              ))}
            </div>
          )}
      </CardContent>
    </Card>
  );
}
