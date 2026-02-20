"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Star,
  TrendingUp,
  Target,
  Award,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from "lucide-react";

interface ScoreDetail {
  score: number;
  max: number;
  details: string;
  improvements?: string[];
  missing_sections?: string[];
  weak_sections?: string[];
  strengths?: string[];
}

interface SectionScore {
  section_name: string;
  score: number;
  max: number;
  feedback: string;
}

interface PlanEvaluation {
  total_score: number;
  grade: string;
  submission_ready: boolean;
  scores: {
    structure_match: ScoreDetail;
    content_fulfillment: ScoreDetail;
    competitiveness: ScoreDetail;
  };
  section_scores?: SectionScore[];
  overall_feedback: string;
  top_improvements: string[];
  estimated_pass_rate: string;
}

interface PlanEvaluationProps {
  planId: string;
  planStatus: string;
}

type LucideIcon = typeof CheckCircle2;
const GRADE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: LucideIcon }> = {
  S: { label: "제출 가능", color: "text-green-700", bg: "bg-green-50", icon: CheckCircle2 },
  A: { label: "소폭 보완", color: "text-blue-700", bg: "bg-blue-50", icon: Star },
  B: { label: "보완 필요", color: "text-yellow-700", bg: "bg-yellow-50", icon: AlertTriangle },
  C: { label: "대폭 보완", color: "text-orange-700", bg: "bg-orange-50", icon: AlertTriangle },
  D: { label: "재작성 필요", color: "text-red-700", bg: "bg-red-50", icon: XCircle },
};

const SCORE_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  structure_match: { label: "구조 일치도", icon: Target },
  content_fulfillment: { label: "내용 충족도", icon: TrendingUp },
  competitiveness: { label: "경쟁력", icon: Award },
};

export function PlanEvaluation({ planId, planStatus }: PlanEvaluationProps) {
  const [evaluation, setEvaluation] = useState<PlanEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showSections, setShowSections] = useState(false);

  // 초기 로드
  useEffect(() => {
    if (planStatus !== "completed") return;

    fetch(`/api/plans/${planId}/evaluate`)
      .then((res) => res.json())
      .then((data) => {
        if (data.evaluated && data.evaluation) {
          setEvaluation(data.evaluation);
        }
      })
      .catch(() => {});
  }, [planId, planStatus]);

  const handleEvaluate = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/plans/${planId}/evaluate`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success && data.evaluation) {
        setEvaluation(data.evaluation);
      } else {
        setError(data.error || "평가 실패");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    }

    setLoading(false);
  };

  if (planStatus !== "completed") {
    return null;
  }

  // 아직 평가 안 됨
  if (!evaluation) {
    return (
      <Card className="border-indigo-200">
        <CardContent className="p-5 text-center">
          <Shield className="h-8 w-8 text-indigo-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-indigo-900 mb-1">
            제출 적합성 평가
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            AI가 사업계획서와 공고 지침의 매칭을 분석합니다
          </p>
          {error && (
            <p className="text-xs text-red-600 mb-2">{error}</p>
          )}
          <Button
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={handleEvaluate}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                평가 중... (30초 소요)
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                매칭 점수 평가
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 평가 결과 표시
  const gradeConfig = GRADE_CONFIG[evaluation.grade] || GRADE_CONFIG.D;
  const GradeIcon = gradeConfig.icon;

  return (
    <Card className="border-indigo-200 overflow-hidden">
      <CardHeader className={`pb-3 ${gradeConfig.bg}`}>
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${gradeConfig.bg} border-2 ${
            evaluation.submission_ready ? "border-green-300" : "border-orange-300"
          }`}>
            <span className={`text-2xl font-bold ${gradeConfig.color}`}>
              {evaluation.total_score}
            </span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-bold">제출 적합성</CardTitle>
              <Badge className={`${gradeConfig.bg} ${gradeConfig.color} text-[10px]`}>
                <GradeIcon className="h-3 w-3 mr-0.5" />
                {evaluation.grade}등급 — {gradeConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              예상 선정률: {evaluation.estimated_pass_rate}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* 3차원 점수 바 */}
        <div className="space-y-2">
          {Object.entries(SCORE_LABELS).map(([key, config]) => {
            const scoreData = evaluation.scores[key as keyof typeof evaluation.scores];
            if (!scoreData) return null;
            const percentage = Math.round((scoreData.score / scoreData.max) * 100);
            const Icon = config.icon;

            return (
              <div key={key}>
                <div className="flex items-center gap-2 text-xs mb-1">
                  <Icon className="h-3 w-3 text-gray-400" />
                  <span className="text-gray-600 flex-1">{config.label}</span>
                  <span className="font-bold text-gray-900">
                    {scoreData.score}/{scoreData.max}
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      percentage >= 80
                        ? "bg-green-500"
                        : percentage >= 60
                        ? "bg-blue-500"
                        : percentage >= 40
                        ? "bg-yellow-500"
                        : "bg-red-400"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 종합 피드백 */}
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="text-xs text-gray-700 whitespace-pre-wrap">
            {evaluation.overall_feedback}
          </p>
        </div>

        {/* Top 개선사항 */}
        {evaluation.top_improvements && evaluation.top_improvements.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-500 mb-1.5">핵심 개선사항</p>
            <div className="space-y-1">
              {evaluation.top_improvements.map((imp, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-100 text-[9px] font-bold text-orange-700 flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-gray-600">{imp}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 상세 보기 토글 */}
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="w-full flex items-center justify-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 py-1"
        >
          {showDetails ? "간략히" : "상세 분석 보기"}
          {showDetails ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>

        {showDetails && (
          <div className="space-y-3 pt-1 border-t border-gray-100">
            {Object.entries(SCORE_LABELS).map(([key, config]) => {
              const scoreData = evaluation.scores[key as keyof typeof evaluation.scores];
              if (!scoreData) return null;

              return (
                <div key={key} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-gray-700 mb-1">
                    {config.label} — {scoreData.score}/{scoreData.max}점
                  </p>
                  <p className="text-xs text-gray-600 mb-2">{scoreData.details}</p>

                  {scoreData.improvements && scoreData.improvements.length > 0 && (
                    <div className="space-y-0.5">
                      {scoreData.improvements.map((imp, i) => (
                        <p key={i} className="text-[10px] text-orange-600">
                          💡 {imp}
                        </p>
                      ))}
                    </div>
                  )}

                  {scoreData.missing_sections && scoreData.missing_sections.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {scoreData.missing_sections.map((sec, i) => (
                        <Badge key={i} variant="destructive" className="text-[9px]">
                          누락: {sec}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {scoreData.strengths && scoreData.strengths.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {scoreData.strengths.map((str, i) => (
                        <Badge key={i} className="bg-green-50 text-green-700 text-[9px]">
                          ✓ {str}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 섹션별 점수 */}
        {evaluation.section_scores && evaluation.section_scores.length > 0 && (
          <div>
            <button
              onClick={() => setShowSections(!showSections)}
              className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-700 py-1"
            >
              {showSections ? "섹션별 점수 접기" : "섹션별 점수 보기"}
              {showSections ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>

            {showSections && (
              <div className="space-y-1.5 pt-1">
                {evaluation.section_scores.map((sec, i) => {
                  const pct = Math.round((sec.score / sec.max) * 100);
                  return (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded">
                      <span className="text-xs text-gray-700 flex-1 truncate">
                        {sec.section_name}
                      </span>
                      <span className={`text-[10px] font-bold ${
                        pct >= 80 ? "text-green-600" : pct >= 60 ? "text-blue-600" : pct >= 40 ? "text-yellow-600" : "text-red-600"
                      }`}>
                        {sec.score}/{sec.max}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 재평가 버튼 */}
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2 text-xs"
          onClick={handleEvaluate}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          재평가
        </Button>
      </CardContent>
    </Card>
  );
}
