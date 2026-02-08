/**
 * PPTX 빌더 v2 — pptxgenjs를 사용한 IR PPT 생성 (차트/인포그래픽 강화)
 * Stage 1.5에서 추출한 chart_data를 활용하여 실제 차트 삽입
 */

import PptxGenJS from "pptxgenjs";
import { SlideType, SLIDE_LABELS } from "@/lib/ai/prompts/ir";

interface ChartDataItem {
  type: "bar" | "pie" | "line" | "tam_sam_som" | "comparison_table" | "timeline" | "highlight_cards";
  title: string;
  data: Record<string, unknown>;
}

interface SlideData {
  slide_type: SlideType;
  title: string;
  content: {
    headline?: string;
    subtext?: string;
    bullets?: string[];
    data?: Record<string, unknown>;
    stats?: Array<{ icon?: string; value: string; label: string }>;
    chart?: ChartDataItem;
  };
  notes?: string;
}

interface PptxOptions {
  companyName: string;
  template?: "minimal" | "tech" | "classic";
  slides: SlideData[];
  kpiData?: Record<string, unknown>;
}

// 템플릿별 색상 설정
const TEMPLATES = {
  minimal: {
    primary: "2563EB",
    secondary: "1E40AF",
    accent: "3B82F6",
    bg: "FFFFFF",
    textDark: "1F2937",
    textLight: "6B7280",
    positive: "22C55E",
    negative: "EF4444",
    chartColors: ["2563EB", "3B82F6", "60A5FA", "93C5FD", "BFDBFE"],
  },
  tech: {
    primary: "7C3AED",
    secondary: "5B21B6",
    accent: "8B5CF6",
    bg: "0F172A",
    textDark: "FFFFFF",
    textLight: "94A3B8",
    positive: "34D399",
    negative: "F87171",
    chartColors: ["7C3AED", "8B5CF6", "A78BFA", "C4B5FD", "DDD6FE"],
  },
  classic: {
    primary: "DC2626",
    secondary: "991B1B",
    accent: "EF4444",
    bg: "FFFFFF",
    textDark: "1F2937",
    textLight: "6B7280",
    positive: "22C55E",
    negative: "EF4444",
    chartColors: ["DC2626", "EF4444", "F87171", "FCA5A5", "FECACA"],
  },
};

type TemplateColors = (typeof TEMPLATES)["minimal"];

/**
 * 슬라이드에 막대 차트 삽입
 */
function addBarChart(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
) {
  const { labels, values, unit } = chart.data as {
    labels?: string[];
    values?: number[];
    unit?: string;
  };
  if (!labels || !values) return yPos;

  const chartData = [
    {
      name: chart.title || "데이터",
      labels,
      values,
    },
  ];

  slide.addChart("bar", chartData, {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 3.0,
    showTitle: true,
    title: chart.title,
    titleColor: colors.textDark,
    titleFontSize: 10,
    showValue: true,
    dataLabelFontSize: 8,
    catAxisLabelColor: colors.textDark,
    valAxisLabelColor: colors.textLight,
    chartColors: colors.chartColors,
    valAxisLabelFormatCode: unit === "%" ? "0.0%" : "#,##0",
  });

  return yPos + 3.2;
}

/**
 * 슬라이드에 원형 차트 삽입
 */
function addPieChart(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
) {
  const { items } = chart.data as {
    items?: Array<{ name: string; value: number }>;
  };
  if (!items || items.length === 0) return yPos;

  const chartData = [
    {
      name: chart.title || "데이터",
      labels: items.map((i) => i.name),
      values: items.map((i) => i.value),
    },
  ];

  slide.addChart("pie", chartData, {
    x: 2.0,
    y: yPos,
    w: 6,
    h: 3.0,
    showTitle: true,
    title: chart.title,
    titleColor: colors.textDark,
    titleFontSize: 10,
    showPercent: true,
    showLegend: true,
    legendPos: "r",
    legendColor: colors.textDark,
    legendFontSize: 8,
    chartColors: colors.chartColors,
  });

  return yPos + 3.2;
}

/**
 * 슬라이드에 선 그래프 삽입
 */
function addLineChart(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
) {
  const { labels, values } = chart.data as {
    labels?: string[];
    values?: number[];
  };
  if (!labels || !values) return yPos;

  const chartData = [
    {
      name: chart.title || "추이",
      labels,
      values,
    },
  ];

  slide.addChart("line", chartData, {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 3.0,
    showTitle: true,
    title: chart.title,
    titleColor: colors.textDark,
    titleFontSize: 10,
    showValue: true,
    dataLabelFontSize: 8,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 8,
    catAxisLabelColor: colors.textDark,
    valAxisLabelColor: colors.textLight,
    chartColors: [colors.primary],
  });

  return yPos + 3.2;
}

/**
 * 슬라이드에 도넛 차트 삽입 (TAM/SAM/SOM용)
 */
function addDoughnutChart(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
) {
  const { tam, sam, som } = chart.data as {
    tam?: string;
    sam?: string;
    som?: string;
  };
  if (!tam && !sam && !som) return yPos;

  // TAM/SAM/SOM을 시각적 텍스트로 표현 (동심원 대체)
  const tamNum = parseFloat(tam?.replace(/[^0-9.]/g, "") || "0");
  const samNum = parseFloat(sam?.replace(/[^0-9.]/g, "") || "0");
  const somNum = parseFloat(som?.replace(/[^0-9.]/g, "") || "0");

  if (tamNum > 0 || samNum > 0 || somNum > 0) {
    const chartData = [
      {
        name: "시장 규모",
        labels: ["TAM", "SAM", "SOM"],
        values: [tamNum, samNum, somNum],
      },
    ];

    slide.addChart("doughnut", chartData, {
      x: 0.5,
      y: yPos,
      w: 4.5,
      h: 3.0,
      showTitle: false,
      showPercent: false,
      showValue: true,
      dataLabelFontSize: 10,
      showLegend: true,
      legendPos: "r",
      legendColor: colors.textDark,
      legendFontSize: 10,
      chartColors: [colors.primary, colors.accent, colors.chartColors[2]],
    });

    // 우측에 TAM/SAM/SOM 라벨 추가
    const items = [
      { label: "TAM", value: tam || "-", desc: "전체 시장" },
      { label: "SAM", value: sam || "-", desc: "유효 시장" },
      { label: "SOM", value: som || "-", desc: "목표 시장" },
    ];

    items.forEach((item, idx) => {
      const itemY = yPos + 0.3 + idx * 0.9;
      slide.addText(item.label, {
        x: 5.5,
        y: itemY,
        w: 1.0,
        h: 0.35,
        fontSize: 12,
        bold: true,
        color: colors.chartColors[idx] || colors.primary,
        fontFace: "Arial",
      });
      slide.addText(item.value, {
        x: 6.5,
        y: itemY,
        w: 2.0,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: colors.textDark,
        fontFace: "Arial",
      });
      slide.addText(item.desc, {
        x: 6.5,
        y: itemY + 0.3,
        w: 2.0,
        h: 0.25,
        fontSize: 8,
        color: colors.textLight,
        fontFace: "Arial",
      });
    });

    return yPos + 3.2;
  }

  return yPos;
}

/**
 * 스탯 카드 (핵심 수치 하이라이트) — KPI 표시용
 */
function addStatsCards(
  slide: PptxGenJS.Slide,
  stats: Array<{ icon?: string; value: string; label: string }>,
  colors: TemplateColors,
  yPos: number
) {
  const cardCount = Math.min(stats.length, 4);
  const cardWidth = 9 / cardCount;

  for (let i = 0; i < cardCount; i++) {
    const stat = stats[i];
    const x = 0.5 + i * cardWidth;

    // 카드 배경
    slide.addShape("rect", {
      x,
      y: yPos,
      w: cardWidth - 0.15,
      h: 1.2,
      fill: { color: colors.bg === "FFFFFF" ? "F1F5F9" : "1E293B" },
      rectRadius: 0.1,
    });

    // 아이콘 (있으면)
    if (stat.icon) {
      slide.addText(stat.icon, {
        x,
        y: yPos + 0.05,
        w: cardWidth - 0.15,
        h: 0.3,
        fontSize: 14,
        align: "center",
        fontFace: "Arial",
      });
    }

    // 수치
    slide.addText(stat.value, {
      x,
      y: yPos + (stat.icon ? 0.3 : 0.15),
      w: cardWidth - 0.15,
      h: 0.45,
      fontSize: 20,
      bold: true,
      color: colors.primary,
      align: "center",
      fontFace: "Arial",
    });

    // 라벨
    slide.addText(stat.label, {
      x,
      y: yPos + (stat.icon ? 0.75 : 0.6),
      w: cardWidth - 0.15,
      h: 0.3,
      fontSize: 10,
      color: colors.textLight,
      align: "center",
      fontFace: "Arial",
    });
  }

  return yPos + 1.4;
}

/**
 * 비교 테이블 삽입
 */
function addComparisonTable(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
) {
  const { headers, rows } = chart.data as {
    headers?: string[];
    rows?: string[][];
  };
  if (!headers || !rows || rows.length === 0) return yPos;

  const tableRows: PptxGenJS.TableRow[] = [];

  // 헤더 행
  tableRows.push(
    headers.map((h) => ({
      text: h,
      options: {
        bold: true,
        fontSize: 9,
        color: "FFFFFF",
        fill: { color: colors.primary },
        align: "center" as const,
        fontFace: "Arial",
      },
    }))
  );

  // 데이터 행
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    tableRows.push(
      rows[i].map((cell) => ({
        text: cell,
        options: {
          fontSize: 8,
          color: colors.textDark,
          fill: { color: i % 2 === 0 ? "FFFFFF" : "F8FAFC" },
          align: "center" as const,
          fontFace: "Arial",
        },
      }))
    );
  }

  slide.addTable(tableRows, {
    x: 0.5,
    y: yPos,
    w: 9,
    border: { color: "E2E8F0", pt: 0.5 },
    colW: Array(headers.length).fill(9 / headers.length),
  });

  const tableHeight = 0.35 * (Math.min(rows.length, 6) + 1);
  return yPos + tableHeight + 0.3;
}

/**
 * 차트 데이터를 슬라이드에 삽입하는 라우터
 */
function addChartToSlide(
  slide: PptxGenJS.Slide,
  chart: ChartDataItem,
  colors: TemplateColors,
  yPos: number
): number {
  switch (chart.type) {
    case "bar":
      return addBarChart(slide, chart, colors, yPos);
    case "pie":
      return addPieChart(slide, chart, colors, yPos);
    case "line":
      return addLineChart(slide, chart, colors, yPos);
    case "tam_sam_som":
      return addDoughnutChart(slide, chart, colors, yPos);
    case "comparison_table":
      return addComparisonTable(slide, chart, colors, yPos);
    case "highlight_cards": {
      const items = (chart.data as { items?: Array<{ label: string; value: string }> }).items;
      if (items) {
        return addStatsCards(
          slide,
          items.map((item) => ({ value: item.value, label: item.label })),
          colors,
          yPos
        );
      }
      return yPos;
    }
    case "timeline": {
      const events = (chart.data as { events?: Array<{ date: string; event: string }> }).events;
      if (events && events.length > 0) {
        // 타임라인을 가로 플로우로 표현
        const count = Math.min(events.length, 6);
        const stepW = 9 / count;
        for (let i = 0; i < count; i++) {
          const x = 0.5 + i * stepW;
          // 원형 마커
          slide.addShape("ellipse", {
            x: x + stepW / 2 - 0.15,
            y: yPos + 0.2,
            w: 0.3,
            h: 0.3,
            fill: { color: colors.primary },
          });
          // 연결선
          if (i < count - 1) {
            slide.addShape("rect", {
              x: x + stepW / 2 + 0.15,
              y: yPos + 0.33,
              w: stepW - 0.3,
              h: 0.04,
              fill: { color: colors.accent },
            });
          }
          // 날짜
          slide.addText(events[i].date, {
            x,
            y: yPos + 0.6,
            w: stepW,
            h: 0.3,
            fontSize: 8,
            bold: true,
            color: colors.primary,
            align: "center",
            fontFace: "Arial",
          });
          // 이벤트
          slide.addText(events[i].event, {
            x,
            y: yPos + 0.85,
            w: stepW,
            h: 0.4,
            fontSize: 7,
            color: colors.textDark,
            align: "center",
            fontFace: "Arial",
          });
        }
        return yPos + 1.5;
      }
      return yPos;
    }
    default:
      return yPos;
  }
}

export async function buildPptx(options: PptxOptions): Promise<Buffer> {
  const { companyName, template = "minimal", slides } = options;
  const colors = TEMPLATES[template];

  const pptx = new PptxGenJS();
  pptx.author = "BizPlan AI";
  pptx.company = companyName;
  pptx.title = `${companyName} IR Presentation`;
  pptx.layout = "LAYOUT_16x9";

  for (const slideData of slides) {
    const slide = pptx.addSlide();

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    if (slideData.slide_type === "cover") {
      // ===== 표지 슬라이드 =====
      slide.background = { color: colors.primary };

      slide.addText(companyName, {
        x: 0.5,
        y: 1.5,
        w: 9,
        h: 1.2,
        fontSize: 40,
        bold: true,
        color: "FFFFFF",
        fontFace: "Arial",
      });

      if (slideData.content.headline) {
        slide.addText(slideData.content.headline, {
          x: 0.5,
          y: 2.8,
          w: 9,
          h: 0.8,
          fontSize: 20,
          color: "E0E7FF",
          fontFace: "Arial",
        });
      }

      if (slideData.content.subtext) {
        slide.addText(slideData.content.subtext, {
          x: 0.5,
          y: 4.0,
          w: 9,
          h: 0.5,
          fontSize: 14,
          color: "C7D2FE",
          fontFace: "Arial",
        });
      }
    } else {
      // ===== 일반 슬라이드 =====
      slide.background = { color: colors.bg };

      // 제목
      slide.addText(slideData.title || SLIDE_LABELS[slideData.slide_type], {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.7,
        fontSize: 24,
        bold: true,
        color: colors.primary,
        fontFace: "Arial",
      });

      // 구분선
      slide.addShape("rect", {
        x: 0.5,
        y: 1.0,
        w: 1.5,
        h: 0.04,
        fill: { color: colors.accent },
      });

      let yPos = 1.3;

      // 스탯 카드 (stats 데이터가 있으면 우선 표시)
      if (slideData.content.stats && slideData.content.stats.length > 0) {
        yPos = addStatsCards(slide, slideData.content.stats, colors, yPos);
        yPos += 0.2;
      }

      // 헤드라인
      if (slideData.content.headline) {
        slide.addText(slideData.content.headline, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 0.6,
          fontSize: 16,
          bold: true,
          color: colors.textDark,
          fontFace: "Arial",
        });
        yPos += 0.7;
      }

      // 부가 설명
      if (slideData.content.subtext) {
        slide.addText(slideData.content.subtext, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 0.5,
          fontSize: 12,
          color: colors.textLight,
          fontFace: "Arial",
        });
        yPos += 0.6;
      }

      // 차트 삽입 (chart 데이터가 있으면)
      if (slideData.content.chart) {
        yPos = addChartToSlide(slide, slideData.content.chart, colors, yPos);
      }

      // 불릿 포인트 (차트 아래에 표시)
      if (slideData.content.bullets && slideData.content.bullets.length > 0) {
        const remainingHeight = 5.0 - yPos;
        if (remainingHeight > 0.5) {
          const bulletText = slideData.content.bullets
            .map((b) => `• ${b}`)
            .join("\n");

          slide.addText(bulletText, {
            x: 0.5,
            y: yPos,
            w: 9,
            h: Math.min(remainingHeight, 3.0),
            fontSize: 14,
            color: colors.textDark,
            fontFace: "Arial",
            lineSpacingMultiple: 1.5,
            valign: "top",
          });
        }
      }

      // 슬라이드 라벨 (우하단)
      slide.addText(SLIDE_LABELS[slideData.slide_type], {
        x: 8.0,
        y: 5.0,
        w: 1.5,
        h: 0.3,
        fontSize: 8,
        color: colors.textLight,
        fontFace: "Arial",
        align: "right",
      });
    }
  }

  // Buffer로 반환
  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}
