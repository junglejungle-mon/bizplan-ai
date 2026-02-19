"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  RefreshCw,
  Loader2,
  Sparkles,
  AlertCircle,
  Image,
} from "lucide-react";
import { SectionContent } from "./section-content";
import { sanitizeSvg } from "@/lib/utils/svg-sanitizer";

interface ChartItem {
  chart_type: string;
  title: string;
  section_order: number;
  priority: string;
  width: number;
  height: number;
  svg: string;
}

interface InterleavedContentProps {
  planId: string;
  sectionId: string;
  sectionName: string;
  sectionContent: string;
  sectionOrder: number;
  onClickEdit?: () => void;
  regenerating?: boolean;
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
  risk_management: "리스크 관리",
};

/**
 * 마크다운 텍스트를 ## 헤딩 기준으로 블록 분리 후
 * 차트를 블록 사이에 인터리빙하여 렌더링
 */
export function InterleavedContent({
  planId,
  sectionId,
  sectionName,
  sectionContent,
  sectionOrder,
  onClickEdit,
  regenerating,
}: InterleavedContentProps) {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 차트 로드
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
        }
      } catch (e) {
        if (!cancelled) console.warn("[InterleavedContent] 로드 실패:", e);
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

  // 차트 추출
  const handleExtractCharts = async () => {
    if (!sectionContent) return;
    setExtracting(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/charts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId, sectionName, sectionContent, sectionOrder }),
      });
      const data = await res.json();
      if (data.success && data.charts && data.charts.length > 0) {
        setCharts(data.charts);
      } else if (data.error) {
        setError(data.error);
      } else {
        setError("시각화할 데이터를 찾지 못했습니다.");
      }
    } catch {
      setError("차트 추출 중 오류 발생");
    }
    setExtracting(false);
  };

  // 마크다운을 ## 기준으로 블록 분리
  const splitContentIntoBlocks = (content: string): string[] => {
    const lines = content.split("\n");
    const blocks: string[] = [];
    let current: string[] = [];

    for (const line of lines) {
      if (line.match(/^## /) && current.length > 0) {
        blocks.push(current.join("\n"));
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) {
      blocks.push(current.join("\n"));
    }
    return blocks;
  };

  const contentBlocks = splitContentIntoBlocks(sectionContent);

  type InterleavedItem = { type: "text"; content: string } | { type: "chart"; chart: ChartItem };

  // 차트를 블록 사이에 배분
  const distributeCharts = (): InterleavedItem[] => {
    const items: InterleavedItem[] = [];

    if (charts.length === 0) {
      // 차트 없으면 텍스트만
      for (const block of contentBlocks) {
        items.push({ type: "text", content: block });
      }
      return items;
    }

    // 블록 수에 맞춰 차트 분배: 첫 블록 뒤부터 차트 배치
    const numBlocks = contentBlocks.length;
    // 차트를 넣을 수 있는 슬롯: 각 블록 뒤 (마지막 블록 포함)
    const slots = numBlocks;
    const chartsPerSlot = Math.ceil(charts.length / Math.max(1, slots - 1 || 1));

    let chartIdx = 0;

    for (let i = 0; i < contentBlocks.length; i++) {
      items.push({ type: "text", content: contentBlocks[i] });

      // 첫 블록 뒤부터 차트 배치 (i >= 0이면 배치, 하지만 첫 블록은 보통 # 제목이므로 i >= 1)
      if (i >= 0 && chartIdx < charts.length) {
        // 마지막 블록이 아니면 1개씩, 마지막이면 나머지 전부
        const isLast = i === contentBlocks.length - 1;
        const count = isLast
          ? charts.length - chartIdx
          : Math.min(1, charts.length - chartIdx);

        for (let j = 0; j < count && chartIdx < charts.length; j++) {
          items.push({ type: "chart", chart: charts[chartIdx] });
          chartIdx++;
        }
      }
    }

    return items;
  };

  const interleavedItems = distributeCharts();

  // 차트 1개 렌더링
  const renderChart = (chart: ChartItem, idx: number) => (
    <div
      key={`chart-${chart.chart_type}-${idx}`}
      className="my-4 rounded-lg border border-orange-100 bg-white overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-1.5 bg-orange-50 border-b border-orange-100">
        <div className="flex items-center gap-1.5">
          <Image className="h-3 w-3 text-orange-500" />
          <span className="text-[10px] font-medium text-orange-700">
            {CHART_TYPE_LABELS[chart.chart_type] || chart.chart_type}
          </span>
        </div>
        <span className="text-[10px] text-orange-400">{chart.title}</span>
      </div>
      <div
        className="p-2 flex justify-center bg-white [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: sanitizeSvg(chart.svg) }}
        style={{ maxWidth: "100%", overflow: "hidden" }}
      />
    </div>
  );

  return (
    <div>
      {/* 인터리빙된 콘텐츠 */}
      {interleavedItems.map((item, idx) => {
        if (item.type === "text") {
          return (
            <div
              key={`text-${idx}`}
              className="cursor-pointer hover:bg-gray-50 rounded-lg transition-colors -mx-2 px-2 py-1"
              onClick={() => {
                if (!regenerating && onClickEdit) onClickEdit();
              }}
            >
              <SectionContent content={item.content} />
            </div>
          );
        }
        return renderChart(item.chart, idx);
      })}

      {/* 차트 컨트롤: 인포그래픽 생성/재추출 버튼 */}
      <div className="mt-3 flex items-center gap-2">
        {loading && !initialLoaded ? (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            차트 로딩 중...
          </div>
        ) : charts.length === 0 ? (
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
        ) : (
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
            <BarChart3 className="h-3 w-3" />
            인포그래픽 재추출 ({charts.length}개)
          </Button>
        )}
        {error && (
          <div className="flex items-center gap-1.5 text-[10px] text-red-500">
            <AlertCircle className="h-3 w-3 flex-shrink-0" />
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
