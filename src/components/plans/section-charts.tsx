"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronUp,
  Image,
  Sparkles,
  AlertCircle,
} from "lucide-react";

interface ChartItem {
  chart_type: string;
  title: string;
  section_order: number;
  priority: string;
  width: number;
  height: number;
  svg: string;
}

interface SectionChartsProps {
  planId: string;
  sectionId: string;
  sectionName: string;
  sectionContent: string | null;
  sectionOrder: number;
}

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "막대 차트",
  pie: "파이 차트",
  line: "라인 차트",
  tam_sam_som: "TAM/SAM/SOM",
  comparison_table: "비교표",
  timeline: "타임라인",
  highlight_cards: "핵심 수치",
  pain_points: "페인포인트",
  tco_comparison: "TCO 비교",
  step_roadmap: "단계별 로드맵",
  revenue_model: "수익 모델",
  org_chart: "조직도",
  ecosystem_map: "생태계 맵",
  esg_cards: "ESG 카드",
};

export function SectionCharts({
  planId,
  sectionId,
  sectionName,
  sectionContent,
  sectionOrder,
}: SectionChartsProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 차트 데이터 로드 (초기) — 디바운스 300ms + cancel 지원
  useEffect(() => {
    if (!sectionContent || sectionContent.length < 50) return;

    let cancelled = false;

    const loadCharts = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/plans/${planId}/charts?sectionOrder=${sectionOrder}`
        );
        if (!res.ok) throw new Error("차트 로드 실패");
        const data = await res.json();
        if (!cancelled && data.charts && data.charts.length > 0) {
          setCharts(data.charts);
          setExpanded(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.warn("[SectionCharts] 로드 실패:", e);
        }
      }
      if (!cancelled) {
        setLoading(false);
        setInitialLoaded(true);
      }
    };

    const timer = setTimeout(loadCharts, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [planId, sectionOrder, sectionContent]);

  // 차트 재추출
  const handleExtractCharts = async () => {
    if (!sectionContent) return;
    setExtracting(true);
    setError(null);

    try {
      const res = await fetch(`/api/plans/${planId}/charts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId,
          sectionName,
          sectionContent,
          sectionOrder,
        }),
      });

      const data = await res.json();
      if (data.success && data.charts && data.charts.length > 0) {
        setCharts(data.charts);
        setExpanded(true);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("이 섹션에서 시각화할 데이터를 찾지 못했습니다. 내용을 보강한 후 다시 시도해보세요.");
      }
    } catch (e) {
      setError("차트 추출 중 오류가 발생했습니다");
    }

    setExtracting(false);
  };

  // 섹션 콘텐츠 없으면 표시 안함
  if (!sectionContent || sectionContent.length < 50) return null;

  // 로딩 중
  if (loading && !initialLoaded) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        차트 로딩 중...
      </div>
    );
  }

  // 차트 없으면 추출 버튼만
  if (charts.length === 0) {
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs border-orange-200 text-orange-600 hover:bg-orange-50"
            onClick={handleExtractCharts}
            disabled={extracting}
          >
            {extracting ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                차트 추출 중...
              </>
            ) : (
              <>
                <Sparkles className="h-3 w-3" />
                인포그래픽 생성
              </>
            )}
          </Button>
          <span className="text-[10px] text-gray-400">
            AI가 섹션 내용에서 시각화 가능한 데이터를 추출합니다
          </span>
        </div>
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-500">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    );
  }

  // 차트 표시
  return (
    <div className="mt-4">
      {/* 헤더: 토글 + 재추출 */}
      <div className="flex items-center justify-between mb-2">
        <button
          className="flex items-center gap-1.5 text-xs font-medium text-orange-600 hover:text-orange-700"
          onClick={() => setExpanded(!expanded)}
        >
          <BarChart3 className="h-3.5 w-3.5" />
          인포그래픽 ({charts.length}개)
          {expanded ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1 text-[10px] text-gray-400 hover:text-gray-600 h-6 px-2"
          onClick={handleExtractCharts}
          disabled={extracting}
        >
          {extracting ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          재추출
        </Button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="flex items-center gap-1.5 text-[10px] text-red-500 mb-2">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* 차트 그리드 */}
      {expanded && (
        <div className="grid grid-cols-1 gap-3">
          {charts.map((chart, i) => (
            <div
              key={`${chart.chart_type}-${i}`}
              className="rounded-lg border border-orange-100 bg-white overflow-hidden"
            >
              {/* 차트 타입 라벨 */}
              <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 border-b border-orange-100">
                <div className="flex items-center gap-1.5">
                  <Image className="h-3 w-3 text-orange-500" />
                  <span className="text-[10px] font-medium text-orange-700">
                    {CHART_TYPE_LABELS[chart.chart_type] || chart.chart_type}
                  </span>
                </div>
                <span className="text-[10px] text-orange-400">
                  {chart.title}
                </span>
              </div>
              {/* SVG 렌더링 */}
              <div
                className="p-2 flex justify-center bg-white"
                dangerouslySetInnerHTML={{ __html: chart.svg }}
                style={{
                  maxWidth: "100%",
                  overflow: "hidden",
                }}
              />
              <style jsx>{`
                div :global(svg) {
                  max-width: 100%;
                  height: auto;
                }
              `}</style>
            </div>
          ))}

          {/* DOCX/PDF 안내 */}
          <p className="text-[10px] text-gray-400 text-center py-1">
            💡 DOCX/PDF 내보내기 시 이 차트들이 자동으로 포함됩니다
          </p>
        </div>
      )}
    </div>
  );
}
