/**
 * PPTX 빌더 v2 — pptxgenjs를 사용한 IR PPT 생성 (차트/인포그래픽 강화)
 * Stage 1.5에서 추출한 chart_data를 활용하여 실제 차트 삽입
 */

import PptxGenJS from "pptxgenjs";
import { SlideType, SLIDE_LABELS } from "@/lib/ai/prompts/ir";

interface ChartDataItem {
  type: "bar" | "pie" | "line" | "tam_sam_som" | "comparison_table" | "timeline" | "highlight_cards" | "pain_points" | "tco_comparison" | "revenue_model" | "org_chart" | "ecosystem_map" | "esg_cards" | "step_roadmap";
  title: string;
  data: Record<string, unknown>;
}

interface SlideData {
  slide_type: SlideType;
  title?: string;
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
  title?: string;
  companyName: string;
  template?: "minimal" | "tech" | "classic" | "professional" | "vibrant" | "custom_ci";
  slides: SlideData[];
  kpiData?: Record<string, unknown>;
  /** true면 Playwright HTML→이미지 고품질 차트 사용, false면 pptxgenjs 네이티브 차트 */
  useHtmlCharts?: boolean;
  /** 미리 렌더링된 차트 이미지 맵 (슬라이드 인덱스 → { chart?: Buffer, stats?: Buffer }) */
  preRenderedImages?: Map<number, { chart?: Buffer; stats?: Buffer }>;
  customColors?: {
    primary: string;
    secondary: string;
    accent: string;
    bg?: string;
    textDark?: string;
    textLight?: string;
    chartColors?: string[];
  };
}

// 템플릿별 색상 설정
// SKILL.md 스펙 + NAS 실제 선정 PPT 색상 분석 반영
// - 선정 PPT 주요색: #023793(네이비), #003366(다크블루), #FF0000(강조레드)
// - 폰트: KoPub돋움, 에스코어드림, 맑은고딕
const TEMPLATES = {
  minimal: {
    // SKILL.md: #1a1a2e(다크네이비) + #4361ee(블루포인트)
    // NAS 분석: #023793 + #003366 계열
    primary: "1A1A2E",
    secondary: "023793",
    accent: "4361EE",
    bg: "FFFFFF",
    textDark: "1A1A2E",
    textLight: "6B7280",
    positive: "22C55E",
    negative: "EF4444",
    chartColors: ["023793", "4361EE", "6C8EF2", "A0B4F5", "D0DBF9"],
  },
  tech: {
    // SKILL.md: #58a6ff(라이트블루) + #7ee787(그린) on dark
    primary: "58A6FF",
    secondary: "388BFD",
    accent: "7EE787",
    bg: "0D1117",
    textDark: "FFFFFF",
    textLight: "8B949E",
    positive: "7EE787",
    negative: "F85149",
    chartColors: ["58A6FF", "388BFD", "7EE787", "D2A8FF", "F778BA"],
  },
  classic: {
    // SKILL.md: #2c3e50(네이비) + #e74c3c(레드포인트)
    // NAS 분석: #003366 + #FF0000 조합 (정글몬스터 표준안)
    primary: "2C3E50",
    secondary: "003366",
    accent: "E74C3C",
    bg: "F8F9FA",
    textDark: "2C3E50",
    textLight: "6B7280",
    positive: "27AE60",
    negative: "E74C3C",
    chartColors: ["2C3E50", "E74C3C", "3498DB", "2ECC71", "F39C12"],
  },
  professional: {
    // 기업형 IR: 차분한 틸블루 + 골드 액센트
    primary: "0F2B46",
    secondary: "1B4F72",
    accent: "D4A843",
    bg: "FFFFFF",
    textDark: "0F2B46",
    textLight: "5D6D7E",
    positive: "1E8449",
    negative: "C0392B",
    chartColors: ["0F2B46", "1B4F72", "D4A843", "2E86C1", "85929E"],
  },
  vibrant: {
    // 스타트업 감성: 퍼플-코랄 그라데이션
    primary: "2D1B69",
    secondary: "6C3CE0",
    accent: "FF6B6B",
    bg: "FFFFFF",
    textDark: "2D1B69",
    textLight: "7B8794",
    positive: "06D6A0",
    negative: "EF476F",
    chartColors: ["6C3CE0", "FF6B6B", "06D6A0", "FFD166", "118AB2"],
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
  const raw = chart.data as {
    labels?: string[];
    values?: number[];
    datasets?: Array<{ label?: string; data?: number[]; values?: number[]; color?: string }>;
    unit?: string;
  };
  const labels = raw.labels;
  const unit = raw.unit;

  // datasets 형식 → 멀티시리즈 bar 차트 지원
  if (raw.datasets && raw.datasets.length > 0 && labels) {
    const chartData = raw.datasets.map((ds) => ({
      name: ds.label || "데이터",
      labels: labels,
      values: ds.values || ds.data || [],
    }));

    // 차트 배경 카드
    slide.addShape("roundRect", {
      x: 0.3, y: yPos - 0.1, w: 9.4, h: 3.4,
      fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
      rectRadius: 0.15,
      shadow: { type: "outer", blur: 4, offset: 2, color: "00000015" },
    });

    // 카테고리 라벨이 긴 경우 자동 회전
    const maxLabelLen = Math.max(...labels.map((l) => l.length));
    const catRotate = maxLabelLen > 8 ? 15 : 0;

    slide.addChart("bar", chartData, {
      x: 0.5, y: yPos, w: 9, h: 3.0,
      showTitle: true,
      title: chart.title.length > 30 ? chart.title.slice(0, 28) + "…" : chart.title,
      titleColor: colors.textDark,
      titleFontSize: 11,
      titleFontFace: "Pretendard",
      showValue: true,
      dataLabelFontSize: 8,
      dataLabelColor: colors.textDark,
      catAxisLabelColor: colors.textDark,
      catAxisLabelFontSize: maxLabelLen > 12 ? 7 : 9,
      catAxisLabelFontFace: "Pretendard",
      catAxisLabelRotate: catRotate,
      valAxisLabelColor: colors.textLight,
      valAxisLabelFontSize: 8,
      chartColors: colors.chartColors.slice(0, raw.datasets.length),
      showLegend: true,
      legendPos: "b",
      legendColor: colors.textDark,
      legendFontSize: 8,
      plotArea: { fill: { color: "FFFFFF", transparency: 0 } },
      catGridLine: { color: "F1F5F9", size: 1 },
      valGridLine: { color: "F1F5F9", size: 1 },
    });

    return yPos + 3.5;
  }

  // 단순 values 형식
  const values = raw.values;
  if (!labels || !values) return yPos;

  const chartData = [
    {
      name: chart.title || "데이터",
      labels,
      values,
    },
  ];

  // 차트 배경 카드
  slide.addShape("roundRect", {
    x: 0.3, y: yPos - 0.1, w: 9.4, h: 3.4,
    fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
    rectRadius: 0.15,
    shadow: { type: "outer", blur: 4, offset: 2, color: "00000015" },
  });

  // 카테고리 라벨이 긴 경우 자동 회전 + 폰트 축소
  const maxCatLen = Math.max(...labels.map((l) => l.length));
  const singleRotate = maxCatLen > 8 ? 15 : 0;

  slide.addChart("bar", chartData, {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 3.0,
    showTitle: true,
    title: chart.title.length > 30 ? chart.title.slice(0, 28) + "…" : chart.title,
    titleColor: colors.textDark,
    titleFontSize: 11,
    titleFontFace: "Pretendard",
    showValue: true,
    dataLabelFontSize: 9,
    dataLabelFontBold: true,
    dataLabelColor: colors.textDark,
    catAxisLabelColor: colors.textDark,
    catAxisLabelFontSize: maxCatLen > 12 ? 7 : 9,
    catAxisLabelFontFace: "Pretendard",
    catAxisLabelRotate: singleRotate,
    valAxisLabelColor: colors.textLight,
    valAxisLabelFontSize: 8,
    chartColors: colors.chartColors,
    valAxisLabelFormatCode: unit === "%" ? "0.0%" : "#,##0",
    plotArea: { fill: { color: "FFFFFF", transparency: 0 } },
    catGridLine: { color: "F1F5F9", size: 1 },
    valGridLine: { color: "F1F5F9", size: 1 },
  });

  return yPos + 3.5;
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
  const raw = chart.data as {
    items?: Array<{ name: string; value: number }>;
    labels?: string[];
    values?: number[];
  };

  // items 형식 또는 labels/values 형식 모두 지원
  let pieLabels: string[];
  let pieValues: number[];

  if (raw.items && raw.items.length > 0) {
    pieLabels = raw.items.map((i) => i.name);
    pieValues = raw.items.map((i) => i.value);
  } else if (raw.labels && raw.values && raw.labels.length > 0) {
    pieLabels = raw.labels;
    pieValues = raw.values;
  } else {
    return yPos;
  }

  const chartData = [
    {
      name: chart.title || "데이터",
      labels: pieLabels,
      values: pieValues,
    },
  ];

  // 차트 배경 카드 + 우측 범례 레이아웃
  slide.addShape("roundRect", {
    x: 0.3, y: yPos - 0.1, w: 9.4, h: 2.1,
    fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
    rectRadius: 0.15,
    shadow: { type: "outer", blur: 4, offset: 2, color: "00000015" },
  });

  slide.addChart("pie", chartData, {
    x: 0.5,
    y: yPos,
    w: 4.5,
    h: 1.9,
    showTitle: false,
    showPercent: true,
    dataLabelFontSize: 9,
    dataLabelColor: colors.textDark,
    showLegend: false,
    chartColors: colors.chartColors,
  });

  // 우측 범례 (제목 + 항목)
  if (chart.title) {
    slide.addText(chart.title, {
      x: 5.2, y: yPos, w: 4, h: 0.35,
      fontSize: 10, bold: true, color: colors.accent,
      fontFace: "Pretendard",
    });
  }
  for (let li = 0; li < pieLabels.length && li < 5; li++) {
    const legendY = yPos + 0.4 + li * 0.32;
    // 컬러 블록
    slide.addShape("rect", {
      x: 5.2, y: legendY + 0.06, w: 0.18, h: 0.18,
      fill: { color: colors.chartColors[li % colors.chartColors.length] },
    });
    const pieUnit = (chart.data as Record<string, unknown>).unit as string || "";
    // 범례 라벨이 길면 축약
    const pieLabelText = pieLabels[li].length > 15 ? pieLabels[li].slice(0, 13) + "…" : pieLabels[li];
    slide.addText(`${pieLabelText}  ${pieValues[li].toLocaleString()}${pieUnit}`, {
      x: 5.5, y: legendY, w: 4, h: 0.3,
      fontSize: 9, color: colors.textDark,
      fontFace: "Pretendard",
      shrinkText: true,
    });
  }

  return yPos + 2.2;
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

  // 차트 배경 카드
  slide.addShape("roundRect", {
    x: 0.3, y: yPos - 0.1, w: 9.4, h: 3.4,
    fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
    rectRadius: 0.15,
    shadow: { type: "outer", blur: 4, offset: 2, color: "00000015" },
  });

  // 카테고리 라벨이 긴 경우 폰트 축소
  const maxLineLabelLen = Math.max(...labels.map((l) => l.length));

  slide.addChart("line", chartData, {
    x: 0.5,
    y: yPos,
    w: 9,
    h: 3.0,
    showTitle: true,
    title: chart.title.length > 30 ? chart.title.slice(0, 28) + "…" : chart.title,
    titleColor: colors.textDark,
    titleFontSize: 11,
    titleFontFace: "Pretendard",
    showValue: true,
    dataLabelFontSize: 9,
    dataLabelFontBold: true,
    dataLabelColor: colors.primary,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 8,
    lineSmooth: true,
    lineSize: 3,
    catAxisLabelColor: colors.textDark,
    catAxisLabelFontSize: maxLineLabelLen > 12 ? 7 : 9,
    catAxisLabelFontFace: "Pretendard",
    valAxisLabelColor: colors.textLight,
    valAxisLabelFontSize: 8,
    chartColors: [colors.primary],
    plotArea: { fill: { color: "FFFFFF", transparency: 0 } },
    catGridLine: { color: "F1F5F9", size: 1 },
    valGridLine: { color: "F1F5F9", size: 1 },
  });

  return yPos + 3.5;
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
  const rawData = chart.data as Record<string, unknown>;
  // tam/sam/som이 문자열 또는 객체({value, unit}) 형태일 수 있음
  function extractValue(val: unknown): { text: string; num: number } {
    if (!val) return { text: "-", num: 0 };
    if (typeof val === "string") {
      return { text: val, num: parseFloat(val.replace(/[^0-9.]/g, "") || "0") };
    }
    if (typeof val === "object" && val !== null) {
      const obj = val as Record<string, unknown>;
      const v = obj.value ?? obj.amount ?? 0;
      const u = (obj.unit as string) || "";
      return { text: `${v}${u}`, num: parseFloat(String(v).replace(/[^0-9.]/g, "") || "0") };
    }
    return { text: String(val), num: parseFloat(String(val).replace(/[^0-9.]/g, "") || "0") };
  }
  const tamVal = extractValue(rawData.tam);
  const samVal = extractValue(rawData.sam);
  const somVal = extractValue(rawData.som);
  const tam = tamVal.text;
  const sam = samVal.text;
  const som = somVal.text;
  if (!rawData.tam && !rawData.sam && !rawData.som) return yPos;

  // TAM/SAM/SOM을 시각적 텍스트로 표현 (동심원 대체)
  // 단위 통일: 모든 값을 억원 단위로 변환하여 차트 비율이 정확하게 표시
  function normalizeToEok(val: { text: string; num: number }, rawVal: unknown): number {
    if (typeof rawVal === "object" && rawVal !== null) {
      const obj = rawVal as Record<string, unknown>;
      const unit = ((obj.unit as string) || "").toLowerCase();
      const v = val.num;
      if (unit.includes("조")) return v * 10000; // 조원 → 억원
      if (unit.includes("만억")) return v * 10000;
      return v; // 이미 억원 또는 단위 없음
    }
    // 문자열인 경우 텍스트에서 단위 추론
    const txt = val.text;
    if (txt.includes("조")) return val.num * 10000;
    return val.num;
  }
  const tamNum = normalizeToEok(tamVal, rawData.tam);
  const samNum = normalizeToEok(samVal, rawData.sam);
  const somNum = normalizeToEok(somVal, rawData.som);

  if (tamNum > 0 || samNum > 0 || somNum > 0) {
    // 차트에서는 로그 스케일 표현 (차이가 너무 클 때)
    // TAM >> SAM >> SOM이므로 시각적 비율 조정
    const chartData = [
      {
        name: "시장 규모",
        labels: ["TAM", "SAM", "SOM"],
        values: [tamNum, samNum, somNum],
      },
    ];

    // TAM/SAM/SOM 배경 카드
    slide.addShape("roundRect", {
      x: 0.3, y: yPos - 0.1, w: 9.4, h: 3.2,
      fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
      rectRadius: 0.15,
      shadow: { type: "outer", blur: 4, offset: 2, color: "00000015" },
    });

    // 섹션 라벨
    slide.addText("시장 규모 분석", {
      x: 0.5, y: yPos - 0.05, w: 4, h: 0.3,
      fontSize: 10, bold: true, color: colors.accent,
      fontFace: "Pretendard",
    });

    slide.addChart("doughnut", chartData, {
      x: 0.5,
      y: yPos + 0.25,
      w: 4.0,
      h: 2.5,
      showTitle: false,
      showPercent: false,
      showValue: false,
      showLegend: false,
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
        fontFace: "Pretendard",
      });
      slide.addText(item.value, {
        x: 6.5,
        y: itemY,
        w: 2.0,
        h: 0.35,
        fontSize: 14,
        bold: true,
        color: colors.textDark,
        fontFace: "Pretendard",
      });
      slide.addText(item.desc, {
        x: 6.5,
        y: itemY + 0.3,
        w: 2.0,
        h: 0.25,
        fontSize: 8,
        color: colors.textLight,
        fontFace: "Pretendard",
      });
    });

    return yPos + 2.7;
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
  if (!stats || !Array.isArray(stats) || stats.length === 0) return yPos;
  // undefined/null 항목 필터링
  const validStats = stats.filter(s => s && (s.value !== undefined || s.label !== undefined));
  if (validStats.length === 0) return yPos;
  const cardCount = Math.min(validStats.length, 4);
  const totalW = 9;
  const gap = 0.2;
  const cardWidth = (totalW - gap * (cardCount - 1)) / cardCount;

  for (let i = 0; i < cardCount; i++) {
    const stat = validStats[i];
    const x = 0.5 + i * (cardWidth + gap);

    // 카드 배경 (그림자 + 라운드)
    slide.addShape("roundRect", {
      x,
      y: yPos,
      w: cardWidth,
      h: 1.3,
      fill: { color: colors.bg === "FFFFFF" ? "FFFFFF" : "1E293B" },
      rectRadius: 0.1,
      shadow: { type: "outer", blur: 3, offset: 1, color: "00000012" },
    });

    // 좌측 액센트 바 (카드 내부)
    const cardAccentColors = [colors.primary, colors.accent, colors.chartColors?.[2] || colors.secondary, colors.chartColors?.[3] || colors.positive];
    slide.addShape("roundRect", {
      x,
      y: yPos,
      w: 0.06,
      h: 1.3,
      fill: { color: cardAccentColors[i % cardAccentColors.length] },
      rectRadius: 0.03,
    });

    // 아이콘 (있으면) — 아이콘 이름을 이모지로 매핑
    if (stat.icon) {
      const iconMap: Record<string, string> = {
        chart: "📊", bar_chart: "📊", graph: "📈", line_chart: "📈", trending_up: "📈",
        users: "👥", people: "👥", team: "👥", person: "👤", user: "👤",
        target: "🎯", goal: "🎯", bullseye: "🎯", crosshair: "🎯",
        shield: "🛡️", security: "🛡️", lock: "🔒", protect: "🛡️",
        money: "💰", dollar: "💵", revenue: "💰", finance: "💰", won: "₩", currency: "💰",
        star: "⭐", award: "🏆", trophy: "🏆", medal: "🥇",
        rocket: "🚀", launch: "🚀", growth: "🚀",
        clock: "⏰", time: "⏰", calendar: "📅", schedule: "📅",
        check: "✅", success: "✅", done: "✅",
        heart: "❤️", health: "🏥", medical: "🏥", hospital: "🏥",
        globe: "🌍", world: "🌍", global: "🌍", international: "🌐",
        bulb: "💡", idea: "💡", light: "💡", innovation: "💡",
        document: "📄", file: "📄", report: "📄", patent: "📜",
        building: "🏢", company: "🏢", office: "🏢",
        handshake: "🤝", partnership: "🤝", deal: "🤝",
        cpu: "🧠", ai: "🧠", brain: "🧠", tech: "⚙️", gear: "⚙️",
        mobile: "📱", phone: "📱", app: "📱",
        database: "🗃️", data: "📊", storage: "🗃️",
      };
      const iconEmoji = iconMap[stat.icon.toLowerCase()] || stat.icon;
      slide.addText(iconEmoji, {
        x: x + 0.15,
        y: yPos + 0.08,
        w: cardWidth - 0.3,
        h: 0.28,
        fontSize: 16,
        align: "center",
        fontFace: "Pretendard",
      });
    }

    // 수치 (길이에 따라 폰트 자동 축소)
    const safeValue = String(stat.value ?? "-");
    const valueFontSize = safeValue.length > 15 ? 13 : safeValue.length > 10 ? 16 : safeValue.length > 6 ? 18 : 22;
    slide.addText(safeValue, {
      x: x + 0.15,
      y: yPos + (stat.icon ? 0.35 : 0.15),
      w: cardWidth - 0.3,
      h: 0.5,
      fontSize: valueFontSize,
      bold: true,
      color: cardAccentColors[i % cardAccentColors.length],
      align: "center",
      fontFace: "Pretendard",
      shrinkText: true,
    });

    // 라벨 (긴 경우 축약 + shrinkText)
    const safeLabel = String(stat.label ?? "");
    const labelText = safeLabel.length > 30 ? safeLabel.slice(0, 28) + "…" : safeLabel;
    slide.addText(labelText, {
      x: x + 0.15,
      y: yPos + (stat.icon ? 0.85 : 0.65),
      w: cardWidth - 0.3,
      h: 0.35,
      fontSize: 10,
      color: colors.textLight,
      align: "center",
      fontFace: "Pretendard",
      valign: "top",
      shrinkText: true,
    });
  }

  return yPos + 1.5;
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

  // 헤더 텍스트가 긴 경우 폰트 축소
  const maxHeaderLen = Math.max(...headers.map((h) => h.length));
  const headerFontSize = maxHeaderLen > 12 ? 8 : 10;

  // 헤더 행 (그라데이션 느낌 — 진한 배경 + 볼드 텍스트)
  tableRows.push(
    headers.map((h) => ({
      text: h.length > 20 ? h.slice(0, 18) + "…" : h,
      options: {
        bold: true,
        fontSize: headerFontSize,
        color: "FFFFFF",
        fill: { color: colors.primary },
        align: "center" as const,
        fontFace: "Pretendard",
        valign: "middle" as const,
        margin: [4, 8, 4, 8] as [number, number, number, number],
      },
    }))
  );

  // 데이터 행 (짝수/홀수 구분 + 더 나은 간격)
  // 셀 텍스트가 긴 경우 폰트 축소
  const maxCellLen = Math.max(...rows.flat().map((c) => c.length));
  const cellFontSize = maxCellLen > 20 ? 7 : 9;

  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    tableRows.push(
      rows[i].map((cell, colIdx) => ({
        text: cell.length > 30 ? cell.slice(0, 28) + "…" : cell,
        options: {
          fontSize: cellFontSize,
          bold: colIdx === 0,
          color: colors.textDark,
          fill: { color: i % 2 === 0 ? "FFFFFF" : "F1F5F9" },
          align: (colIdx === 0 ? "left" : "center") as "left" | "center",
          fontFace: "Pretendard",
          valign: "middle" as const,
          margin: [3, 8, 3, 8] as [number, number, number, number],
        },
      }))
    );
  }

  // 테이블 배경 카드
  const tableHeight = 0.38 * (Math.min(rows.length, 6) + 1);
  slide.addShape("roundRect", {
    x: 0.3, y: yPos - 0.1, w: 9.4, h: tableHeight + 0.3,
    fill: { color: "FFFFFF" },
    rectRadius: 0.1,
    shadow: { type: "outer", blur: 3, offset: 1, color: "00000010" },
  });

  slide.addTable(tableRows, {
    x: 0.5,
    y: yPos,
    w: 9,
    border: { color: "E2E8F0", pt: 0.5 },
    colW: Array(headers.length).fill(9 / headers.length),
    rowH: Array(Math.min(rows.length, 6) + 1).fill(0.38),
  });

  return yPos + tableHeight + 0.4;
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
      // data.items 또는 data.cards 배열 지원
      const hcData = chart.data as Record<string, unknown>;
      const hcItems = (hcData.items || hcData.cards) as Array<{ label: string; value: string; icon?: string }> | undefined;
      if (hcItems && hcItems.length > 0) {
        return addStatsCards(
          slide,
          hcItems.map((item) => ({ value: item.value, label: item.label, icon: item.icon })),
          colors,
          yPos
        );
      }
      return yPos;
    }
    case "timeline": {
      // data.events 또는 data.milestones 배열 지원
      const tlData = chart.data as Record<string, unknown>;
      const rawEvents = (tlData.events || tlData.milestones || tlData.timeline) as Array<Record<string, string>> | undefined;
      if (rawEvents && rawEvents.length > 0) {
        const events = rawEvents.map((e) => ({
          date: e.date || e.period || e.month || "",
          event: e.event || e.title || e.name || e.kpi || "",
          desc: e.description || e.detail || (Array.isArray(e.tasks) ? e.tasks[0] || "" : "") || "",
        }));
        const count = Math.min(events.length, 6);
        const stepW = 9 / count;

        // 타임라인 배경 카드
        slide.addShape("roundRect", {
          x: 0.3, y: yPos - 0.1, w: 9.4, h: 2.2,
          fill: { color: colors.bg === "FFFFFF" ? "F8FAFC" : "1E293B" },
          rectRadius: 0.15,
          shadow: { type: "outer", blur: 3, offset: 1, color: "00000010" },
        });

        // 중앙 연결선 (전체 가로)
        slide.addShape("rect", {
          x: 0.5 + stepW / 2,
          y: yPos + 0.32,
          w: 9 - stepW,
          h: 0.04,
          fill: { color: colors.accent, transparency: 40 },
        });

        for (let i = 0; i < count; i++) {
          const x = 0.5 + i * stepW;
          const markerColor = i === 0 ? colors.primary : i === count - 1 ? colors.accent : colors.chartColors?.[i % colors.chartColors.length] || colors.primary;

          // 원형 마커 (외부 링 + 내부 원)
          slide.addShape("ellipse", {
            x: x + stepW / 2 - 0.18,
            y: yPos + 0.16,
            w: 0.36,
            h: 0.36,
            fill: { color: markerColor, transparency: 20 },
          });
          slide.addShape("ellipse", {
            x: x + stepW / 2 - 0.12,
            y: yPos + 0.22,
            w: 0.24,
            h: 0.24,
            fill: { color: markerColor },
          });
          // 번호 (마커 내부)
          slide.addText(String(i + 1), {
            x: x + stepW / 2 - 0.12,
            y: yPos + 0.22,
            w: 0.24, h: 0.24,
            fontSize: 9, bold: true, color: "FFFFFF",
            align: "center", valign: "middle",
            fontFace: "Pretendard",
          });
          // 날짜 (shrinkText로 절단 방지)
          slide.addText(events[i].date, {
            x, y: yPos + 0.6, w: stepW, h: 0.3,
            fontSize: 9, bold: true, color: markerColor,
            align: "center", fontFace: "Pretendard",
            shrinkText: true,
          });
          // 이벤트 제목 (긴 경우 축약 + shrinkText)
          const eventTitle = events[i].event.length > 15 ? events[i].event.slice(0, 13) + "…" : events[i].event;
          slide.addText(eventTitle, {
            x, y: yPos + 0.88, w: stepW, h: 0.3,
            fontSize: 9, bold: true, color: colors.textDark,
            align: "center", fontFace: "Pretendard",
            shrinkText: true,
          });
          // 설명 (긴 경우 축약)
          if (events[i].desc) {
            const evtDesc = events[i].desc.length > 25 ? events[i].desc.slice(0, 23) + "…" : events[i].desc;
            slide.addText(evtDesc, {
              x, y: yPos + 1.15, w: stepW, h: 0.4,
              fontSize: 7, color: colors.textLight,
              align: "center", fontFace: "Pretendard",
              shrinkText: true,
            });
          }
        }
        return yPos + 2.0;
      }
      return yPos;
    }
    case "pain_points": {
      // 페인포인트 다이어그램 → stats cards로 표현
      const { points } = chart.data as { points?: Array<{ icon: string; title: string; value: string; description: string }> };
      if (points && points.length > 0) {
        return addStatsCards(
          slide,
          points.map((p) => ({ icon: p.icon, value: p.value, label: `${p.title}\n${p.description}` })),
          colors,
          yPos
        );
      }
      return yPos;
    }

    case "tco_comparison": {
      // TCO 비교 → 비교 테이블
      const tcoData = chart.data as {
        before?: { label: string; total: string; items: Array<{ name: string; value: string }> };
        after?: { label: string; total: string; items: Array<{ name: string; value: string }> };
        saving_rate?: string;
      };
      if (tcoData.before && tcoData.after) {
        const compChart: ChartDataItem = {
          type: "comparison_table",
          title: chart.title,
          data: {
            headers: ["비용 항목", tcoData.before.label, tcoData.after.label],
            rows: [
              ...(tcoData.before.items || []).map((item, i) => [
                item.name,
                item.value,
                tcoData.after?.items?.[i]?.value || "-",
              ]),
              ["합계", tcoData.before.total, tcoData.after.total],
            ],
          },
        };
        return addComparisonTable(slide, compChart, colors, yPos);
      }
      return yPos;
    }

    case "step_roadmap": {
      // 단계별 로드맵 → 가로 플로우 (개선된 비주얼)
      const rawSteps = (chart.data as Record<string, unknown>).steps as Array<Record<string, unknown>> | undefined;
      if (rawSteps && rawSteps.length > 0) {
        const count = Math.min(rawSteps.length, 4);
        const gap = 0.3;
        const totalW = 9;
        const stepW = (totalW - gap * (count - 1)) / count;
        const stepColorPalette = [colors.primary, colors.accent, colors.chartColors?.[2] || colors.secondary || "4A90D9", colors.chartColors?.[3] || colors.positive];
        const statusColors: Record<string, string> = {
          completed: "27AE60", in_progress: colors.accent, planned: colors.secondary || "4A90D9",
        };

        for (let i = 0; i < count; i++) {
          const s = rawSteps[i];
          const x = 0.5 + i * (stepW + gap);
          const stepNum = s.step ?? (i + 1);
          const stepTitle = (s.title as string) || `Step ${i + 1}`;
          const stepPeriod = (s.period as string) || (s.date as string) || "";
          const stepStatus = (s.status as string) || "";
          const stepDesc = (s.description as string) || (s.goal as string) || "";
          const stepTarget = (s.target as string) || "";
          const boxColor = statusColors[stepStatus] || stepColorPalette[i % stepColorPalette.length];

          // 카드 그림자 (아래에 깔기)
          slide.addShape("roundRect", {
            x: x + 0.03, y: yPos + 0.03, w: stepW, h: 1.8,
            fill: { color: boxColor, transparency: 30 },
            rectRadius: 0.12,
          });

          // 메인 카드
          slide.addShape("roundRect", {
            x, y: yPos, w: stepW, h: 1.8,
            fill: { color: boxColor },
            rectRadius: 0.12,
          });

          // 단계 번호 (원형 뱃지)
          slide.addShape("ellipse", {
            x: x + stepW / 2 - 0.2, y: yPos + 0.1, w: 0.4, h: 0.4,
            fill: { color: "FFFFFF", transparency: 20 },
          });
          slide.addText(String(stepNum), {
            x: x + stepW / 2 - 0.2, y: yPos + 0.1, w: 0.4, h: 0.4,
            fontSize: 14, bold: true, color: "FFFFFF",
            align: "center", valign: "middle", fontFace: "Pretendard",
          });

          // 제목 (긴 경우 축약 + shrinkText)
          const truncTitle = stepTitle.length > 12 ? stepTitle.slice(0, 10) + "…" : stepTitle;
          slide.addText(truncTitle, {
            x: x + 0.1, y: yPos + 0.55, w: stepW - 0.2, h: 0.35,
            fontSize: 11, bold: true, color: "FFFFFF",
            align: "center", fontFace: "Pretendard",
            shrinkText: true,
          });

          // 구분선
          slide.addShape("rect", {
            x: x + stepW * 0.2, y: yPos + 0.92, w: stepW * 0.6, h: 0.02,
            fill: { color: "FFFFFF", transparency: 50 },
          });

          // 기간/상태
          const periodText = stepPeriod || (stepStatus === "completed" ? "완료" : stepStatus === "in_progress" ? "진행중" : stepStatus === "planned" ? "예정" : "");
          if (periodText) {
            slide.addText(periodText, {
              x: x + 0.1, y: yPos + 0.97, w: stepW - 0.2, h: 0.22,
              fontSize: 8, color: "E0E7FF",
              align: "center", fontFace: "Pretendard",
            });
          }

          // 설명 (긴 경우 축약 + shrinkText)
          const bodyText = stepTarget && stepDesc ? `${stepTarget}\n${stepDesc}` : stepDesc || stepTarget;
          if (bodyText) {
            const truncBody = bodyText.length > 40 ? bodyText.slice(0, 38) + "…" : bodyText;
            slide.addText(truncBody, {
              x: x + 0.1, y: yPos + 1.2, w: stepW - 0.2, h: 0.5,
              fontSize: 8, color: "FFFFFF",
              align: "center", fontFace: "Pretendard",
              shrinkText: true,
            });
          }

          // 화살표 (카드 사이)
          if (i < count - 1) {
            slide.addText("▶", {
              x: x + stepW, y: yPos + 0.7, w: gap, h: 0.4,
              fontSize: 14, bold: true, color: colors.accent,
              align: "center", fontFace: "Pretendard",
            });
          }
        }
        return yPos + 2.0;
      }
      return yPos;
    }

    case "revenue_model": {
      // 수익 모델 → stats cards로 표현
      const { tracks } = chart.data as { tracks?: Array<{ name: string; subtitle: string; price: string; features: string[] }> };
      if (tracks && tracks.length > 0) {
        return addStatsCards(
          slide,
          tracks.map((t) => ({ value: t.price, label: `${t.name}\n${t.subtitle}` })),
          colors,
          yPos
        );
      }
      return yPos;
    }

    case "esg_cards": {
      // ESG 카드 → stats cards로 표현
      const esgData = chart.data as {
        environment?: { title: string; items: string[] };
        social?: { title: string; items: string[] };
        governance?: { title: string; items: string[] };
      };
      const esgCards: Array<{ icon?: string; value: string; label: string }> = [];
      if (esgData.environment) esgCards.push({ icon: "🌱", value: "Environment", label: esgData.environment.items?.join("\n") || "" });
      if (esgData.social) esgCards.push({ icon: "🤝", value: "Social", label: esgData.social.items?.join("\n") || "" });
      if (esgData.governance) esgCards.push({ icon: "⚖️", value: "Governance", label: esgData.governance.items?.join("\n") || "" });
      if (esgCards.length > 0) {
        return addStatsCards(slide, esgCards, colors, yPos);
      }
      return yPos;
    }

    case "org_chart":
    case "ecosystem_map": {
      // 조직도/생태계 맵 → 비교 테이블로
      const tableData = chart.data as { headers?: string[]; rows?: string[][] };
      if (tableData.headers && tableData.rows) {
        const compChart: ChartDataItem = { type: "comparison_table", title: chart.title, data: tableData };
        return addComparisonTable(slide, compChart, colors, yPos);
      }
      // members 또는 partners 형식
      const membersData = chart.data as { members?: Array<{ role: string; name: string; title: string; detail: string }> };
      const partnersData = chart.data as { partners?: Array<{ name: string; role: string; detail: string; period: string }> };
      if (membersData.members) {
        const compChart: ChartDataItem = {
          type: "comparison_table", title: chart.title,
          data: {
            headers: ["구분", "성명", "직위/역할", "주요 역량"],
            rows: membersData.members.map((m) => [m.role, m.name, m.title, m.detail]),
          },
        };
        return addComparisonTable(slide, compChart, colors, yPos);
      }
      if (partnersData.partners) {
        const compChart: ChartDataItem = {
          type: "comparison_table", title: chart.title,
          data: {
            headers: ["협력기관", "역할", "협력 내용", "기간"],
            rows: partnersData.partners.map((p) => [p.name, p.role, p.detail, p.period]),
          },
        };
        return addComparisonTable(slide, compChart, colors, yPos);
      }
      return yPos;
    }

    default:
      return yPos;
  }
}

/**
 * 공통 슬라이드 장식 — 하단 바, 페이지 번호, 좌측 액센트 바
 */
function addSlideChrome(
  slide: PptxGenJS.Slide,
  colors: TemplateColors,
  pageNum: number,
  totalPages: number,
  companyName: string,
  slideLabel: string,
  isCover: boolean = false
) {
  if (isCover) {
    // 표지: 하단에 얇은 액센트 라인만
    slide.addShape("rect", {
      x: 0, y: 5.15, w: 10, h: 0.04,
      fill: { color: colors.accent },
    });
    // 표지 하단 우측에 날짜
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
    slide.addText(dateStr, {
      x: 7.5, y: 4.8, w: 2, h: 0.3,
      fontSize: 12, color: "FFFFFF", align: "right",
      fontFace: "Pretendard", italic: true,
    });
    return;
  }

  // === 일반 슬라이드 공통 장식 ===

  // 1. 좌측 컬러 액센트 바 (세로 전체)
  slide.addShape("rect", {
    x: 0, y: 0, w: 0.06, h: 5.63,
    fill: { color: colors.primary },
  });

  // 2. 하단 바 (그라데이션 느낌 — 진한색 바)
  slide.addShape("rect", {
    x: 0, y: 5.25, w: 10, h: 0.38,
    fill: { color: colors.primary },
  });

  // 3. 하단 바 위 얇은 액센트 라인
  slide.addShape("rect", {
    x: 0, y: 5.22, w: 10, h: 0.03,
    fill: { color: colors.accent },
  });

  // 4. 하단 바 내부: 회사명 (좌)
  slide.addText(companyName, {
    x: 0.3, y: 5.25, w: 4, h: 0.38,
    fontSize: 8, color: "FFFFFF", fontFace: "Pretendard",
    valign: "middle",
  });

  // 5. 하단 바 내부: 슬라이드 라벨 (중앙)
  slide.addText(slideLabel, {
    x: 3.5, y: 5.25, w: 3, h: 0.38,
    fontSize: 8, color: "C7D2FE", fontFace: "Pretendard",
    align: "center", valign: "middle",
  });

  // 6. 하단 바 내부: 페이지 번호 (우)
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: 8.0, y: 5.25, w: 1.5, h: 0.38,
    fontSize: 9, bold: true, color: "FFFFFF", fontFace: "Pretendard",
    align: "right", valign: "middle",
  });
}

/**
 * 섹션 구분 슬라이드 (선택사항 — 대형 섹션 제목)
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _addSectionDivider(
  slide: PptxGenJS.Slide,
  sectionTitle: string,
  sectionNum: string,
  colors: TemplateColors
) {
  slide.background = { color: colors.primary };

  // 큰 번호
  slide.addText(sectionNum, {
    x: 0.8, y: 1.0, w: 2, h: 1.5,
    fontSize: 72, bold: true, color: colors.accent,
    fontFace: "Pretendard",
  });

  // 섹션 제목
  slide.addText(sectionTitle, {
    x: 0.8, y: 2.5, w: 8, h: 1.0,
    fontSize: 36, bold: true, color: "FFFFFF",
    fontFace: "Pretendard",
  });

  // 장식 라인
  slide.addShape("rect", {
    x: 0.8, y: 3.6, w: 2.0, h: 0.06,
    fill: { color: colors.accent },
  });
}

export async function buildPptx(options: PptxOptions): Promise<Buffer> {
  const { companyName, template = "minimal", slides, customColors, preRenderedImages } = options;

  // custom_ci 템플릿: 사용자가 업로드한 로고에서 추출한 색상 사용
  let colors: TemplateColors;
  if (template === "custom_ci" && customColors) {
    colors = {
      primary: customColors.primary || "1A1A2E",
      secondary: customColors.secondary || "023793",
      accent: customColors.accent || "4361EE",
      bg: customColors.bg || "FFFFFF",
      textDark: customColors.textDark || "1A1A2E",
      textLight: customColors.textLight || "6B7280",
      positive: "22C55E",
      negative: "EF4444",
      chartColors: customColors.chartColors || ["023793", "4361EE", "6C8EF2", "A0B4F5", "D0DBF9"],
    };
  } else {
    colors = TEMPLATES[template as keyof typeof TEMPLATES] || TEMPLATES.minimal;
  }
  const totalPages = slides.length + 1; // +1 for closing slide

  const pptx = new PptxGenJS();
  pptx.author = "BizPlan AI";
  pptx.company = companyName;
  pptx.title = `${companyName} IR Presentation`;
  pptx.layout = "LAYOUT_16x9";

  // 기본 폰트 패밀리 설정 (fallback 포함)
  const FONT_TITLE = "Pretendard";
  const FONT_BODY = "Pretendard";
  const FONT_NUM = "Pretendard";
  // 표준 행간 (기업 PPT 기준 1.3배)
  const LINE_SP = 1.3;
  const LINE_SP_TIGHT = 1.15;

  for (let slideIdx = 0; slideIdx < slides.length; slideIdx++) {
    const slideData = slides[slideIdx];
    const slide = pptx.addSlide();
    const pageNum = slideIdx + 1;

    if (slideData.notes) {
      slide.addNotes(slideData.notes);
    }

    if (slideData.slide_type === "cover") {
      // ===== 표지 슬라이드 (고급 디자인) =====
      slide.background = { color: colors.primary };

      // 좌측 장식 도형 (반원 원 효과)
      slide.addShape("ellipse", {
        x: -1.5, y: -1.0, w: 4, h: 4,
        fill: { color: colors.secondary || colors.primary, transparency: 85 },
      });
      slide.addShape("ellipse", {
        x: -0.5, y: 3.0, w: 2.5, h: 2.5,
        fill: { color: colors.accent, transparency: 90 },
      });

      // 우상단 작은 장식
      slide.addShape("ellipse", {
        x: 8.5, y: -0.5, w: 2.0, h: 2.0,
        fill: { color: colors.accent, transparency: 92 },
      });

      // 회사명 (대형)
      slide.addText(companyName, {
        x: 0.8, y: 1.2, w: 8.5, h: 1.0,
        fontSize: 40, bold: true, color: "FFFFFF",
        fontFace: FONT_TITLE, lineSpacingMultiple: 1.1,
      });

      // 액센트 바
      slide.addShape("rect", {
        x: 0.8, y: 2.3, w: 1.5, h: 0.06,
        fill: { color: colors.accent },
      });

      // 헤드라인 (부제목)
      if (slideData.content.headline) {
        slide.addText(slideData.content.headline, {
          x: 0.8, y: 2.6, w: 8.5, h: 0.8,
          fontSize: 22, color: "E0E7FF",
          fontFace: FONT_TITLE, lineSpacingMultiple: LINE_SP,
        });
      }

      // 서브텍스트
      if (slideData.content.subtext) {
        slide.addText(slideData.content.subtext, {
          x: 0.8, y: 3.6, w: 8.5, h: 0.5,
          fontSize: 14, color: "C7D2FE",
          fontFace: FONT_BODY, lineSpacingMultiple: LINE_SP,
        });
      }

      // 우하단: IR DECK 뱃지
      slide.addShape("roundRect", {
        x: 7.8, y: 4.4, w: 1.7, h: 0.5,
        fill: { color: colors.accent }, rectRadius: 0.05,
      });
      slide.addText("IR DECK", {
        x: 7.8, y: 4.4, w: 1.7, h: 0.5,
        fontSize: 12, bold: true, color: "FFFFFF",
        fontFace: FONT_TITLE, align: "center", valign: "middle",
      });

      // 표지 장식 추가
      addSlideChrome(slide, colors, pageNum, totalPages, companyName, "", true);

    } else {
      // ===== 일반 슬라이드 (개선된 레이아웃) =====
      slide.background = { color: colors.bg };

      // 상단 제목 영역 (좌측 패딩 확대 — 액센트 바 공간)
      const titleText = slideData.title || SLIDE_LABELS[slideData.slide_type];

      // 슬라이드 번호 뱃지 (작은 원형)
      slide.addShape("roundRect", {
        x: 0.3, y: 0.25, w: 0.5, h: 0.5,
        fill: { color: colors.primary }, rectRadius: 0.25,
      });
      slide.addText(String(pageNum).padStart(2, "0"), {
        x: 0.3, y: 0.25, w: 0.5, h: 0.5,
        fontSize: 12, bold: true, color: "FFFFFF",
        fontFace: FONT_NUM, align: "center", valign: "middle",
      });

      // 제목
      slide.addText(titleText, {
        x: 0.95, y: 0.25, w: 8.5, h: 0.6,
        fontSize: 22, bold: true, color: colors.primary,
        fontFace: FONT_TITLE, lineSpacingMultiple: LINE_SP_TIGHT,
      });

      // 제목 아래 구분선 (그라데이션 느낌 — 두 색상 라인)
      slide.addShape("rect", {
        x: 0.95, y: 0.9, w: 1.2, h: 0.04,
        fill: { color: colors.accent },
      });
      slide.addShape("rect", {
        x: 2.15, y: 0.9, w: 0.6, h: 0.04,
        fill: { color: colors.chartColors?.[2] || colors.secondary || colors.accent, transparency: 50 },
      });

      let yPos = 1.15;

      // 스탯 카드 (stats 데이터가 있으면 우선 표시)
      // HTML 이미지 모드: 미리 렌더링된 stats 이미지 사용 (고품질)
      const rendered = preRenderedImages?.get(slideIdx);
      if (rendered?.stats && slideData.content.stats && slideData.content.stats.length > 0) {
        // HTML→이미지 고품질 stats 카드
        const statsImgData = "image/png;base64," + rendered.stats.toString("base64");
        slide.addImage({ data: statsImgData, x: 0.3, y: yPos, w: 9.2, h: 1.1 });
        yPos += 1.2;
      } else if (slideData.content.stats && slideData.content.stats.length > 0) {
        yPos = addStatsCards(slide, slideData.content.stats, colors, yPos);
        yPos += 0.15;
      }

      // 헤드라인
      if (slideData.content.headline) {
        slide.addText(slideData.content.headline, {
          x: 0.5, y: yPos, w: 9, h: 0.55,
          fontSize: 16, bold: true, color: colors.textDark,
          fontFace: FONT_TITLE, lineSpacingMultiple: LINE_SP,
        });
        yPos += 0.65;
      }

      // 부가 설명
      if (slideData.content.subtext) {
        slide.addText(slideData.content.subtext, {
          x: 0.5, y: yPos, w: 9, h: 0.45,
          fontSize: 11, color: colors.textLight,
          fontFace: FONT_BODY, lineSpacingMultiple: LINE_SP,
        });
        yPos += 0.5;
      }

      // 차트 삽입 — HTML 이미지 모드 또는 네이티브 pptxgenjs 차트
      if (rendered?.chart && slideData.content.chart) {
        // HTML→이미지 고품질 차트 (Playwright 렌더링)
        const chartImgData = "image/png;base64," + rendered.chart.toString("base64");
        const chartH = 2.8;
        slide.addImage({ data: chartImgData, x: 0.3, y: yPos, w: 9.2, h: chartH });
        yPos += chartH + 0.1;
      } else if (slideData.content.chart) {
        yPos = addChartToSlide(slide, slideData.content.chart, colors, yPos);
      }

      // 불릿 포인트 (차트 아래에 표시)
      if (slideData.content.bullets && slideData.content.bullets.length > 0) {
        // 하단 바 시작 y=5.22 → 안전 영역 5.05 (여백 확보)
        const maxY = 5.05;
        const remainingHeight = maxY - yPos;
        const bulletCount = slideData.content.bullets.length;

        if (remainingHeight > 0.35) {
          // 남은 공간에 따라 불릿 간격/크기 동적 조절
          const idealSpacing = 0.38;
          const neededHeight = bulletCount * idealSpacing;
          const hasChart = !!slideData.content.chart;

          let bulletSpacing: number;
          let bulletFontSize: number;

          if (neededHeight <= remainingHeight) {
            // 공간 충분 → 기본 간격
            bulletSpacing = idealSpacing;
            bulletFontSize = 12;
          } else if (hasChart && remainingHeight < 1.5) {
            // 차트 있고 공간 매우 부족 → 콤팩트 모드
            bulletSpacing = Math.max(remainingHeight / bulletCount, 0.28);
            bulletFontSize = 10;
          } else {
            // 공간 부족 → 간격 축소
            bulletSpacing = Math.max(remainingHeight / bulletCount, 0.30);
            bulletFontSize = 11;
          }

          const maxBullets = Math.floor(remainingHeight / bulletSpacing);
          const bulletsToShow = Math.min(bulletCount, maxBullets);

          for (let bi = 0; bi < bulletsToShow; bi++) {
            const bulletY = yPos + bi * bulletSpacing;
            if (bulletY > maxY - 0.25) break;

            // 도트 아이콘
            slide.addShape("ellipse", {
              x: 0.55, y: bulletY + 0.1, w: 0.12, h: 0.12,
              fill: { color: colors.accent },
            });

            // 텍스트 (긴 경우 shrinkText 적용)
            slide.addText(slideData.content.bullets[bi], {
              x: 0.8, y: bulletY, w: 8.5, h: bulletSpacing,
              fontSize: bulletFontSize, color: colors.textDark,
              fontFace: FONT_BODY, valign: "middle",
              lineSpacingMultiple: LINE_SP_TIGHT,
              shrinkText: true,
            });
          }
        }
      }

      // 공통 장식 추가
      addSlideChrome(slide, colors, pageNum, totalPages, companyName, SLIDE_LABELS[slideData.slide_type]);
    }
  }

  // ===== 감사(Closing) 슬라이드 =====
  {
    const closingSlide = pptx.addSlide();
    closingSlide.background = { color: colors.primary };

    // 장식 도형 (표지와 대칭)
    closingSlide.addShape("ellipse", {
      x: 7.0, y: -1.0, w: 4.5, h: 4.5,
      fill: { color: colors.secondary || colors.primary, transparency: 85 },
    });
    closingSlide.addShape("ellipse", {
      x: 7.5, y: 3.5, w: 2.5, h: 2.5,
      fill: { color: colors.accent, transparency: 90 },
    });
    closingSlide.addShape("ellipse", {
      x: -1.0, y: 3.0, w: 3.0, h: 3.0,
      fill: { color: colors.accent, transparency: 92 },
    });

    // 감사 인사
    closingSlide.addText("Thank You", {
      x: 0.8, y: 1.0, w: 8.5, h: 1.2,
      fontSize: 48, bold: true, color: "FFFFFF",
      fontFace: FONT_TITLE, align: "center",
    });

    // 구분선
    closingSlide.addShape("rect", {
      x: 4.0, y: 2.3, w: 2.0, h: 0.06,
      fill: { color: colors.accent },
    });

    // 회사명
    closingSlide.addText(companyName, {
      x: 0.8, y: 2.6, w: 8.5, h: 0.7,
      fontSize: 24, color: "E0E7FF",
      fontFace: FONT_TITLE, align: "center",
    });

    // 부가 정보 (이메일/연락처 등 — 일반적 플레이스홀더)
    closingSlide.addText("IR 자료에 관한 문의사항이 있으시면 연락 부탁드립니다.", {
      x: 1.0, y: 3.5, w: 8.0, h: 0.5,
      fontSize: 13, color: "C7D2FE",
      fontFace: FONT_BODY, align: "center",
      lineSpacingMultiple: LINE_SP,
    });

    // 하단 액센트 라인
    closingSlide.addShape("rect", {
      x: 0, y: 5.15, w: 10, h: 0.04,
      fill: { color: colors.accent },
    });

    // 하단 날짜
    const now = new Date();
    const dateStr = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, "0")}`;
    closingSlide.addText(dateStr, {
      x: 7.5, y: 4.8, w: 2, h: 0.3,
      fontSize: 12, color: "FFFFFF", align: "right",
      fontFace: FONT_BODY, italic: true,
    });

    // "BizPlan AI" 워터마크 (작게)
    closingSlide.addText("Generated by BizPlan AI", {
      x: 0.5, y: 5.2, w: 3, h: 0.3,
      fontSize: 8, color: "6B7280",
      fontFace: FONT_BODY, italic: true,
    });
  }

  // Buffer로 반환
  const output = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return output;
}
