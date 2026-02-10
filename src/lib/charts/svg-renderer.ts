/**
 * 14개 차트 타입 SVG 렌더러
 * DOM/canvas 없이 순수 문자열로 SVG 생성
 */

import { ChartTheme, getThemeForTemplate } from "./themes";

// ===== 차트 데이터 인터페이스 (docx-builder와 동일) =====
export interface ChartDataItem {
  type: string;
  title: string;
  data: Record<string, unknown>;
}

export interface SvgRenderOptions {
  width: number;
  height: number;
  theme: ChartTheme;
  scale?: number; // 2x 해상도용
}

// ===== 차트 크기 규격 =====
const CHART_SIZES: Record<string, { width: number; height: number }> = {
  bar: { width: 600, height: 400 },
  pie: { width: 600, height: 400 },
  line: { width: 600, height: 400 },
  tam_sam_som: { width: 600, height: 500 },
  comparison_table: { width: 600, height: 400 },
  timeline: { width: 600, height: 250 },
  highlight_cards: { width: 600, height: 200 },
  pain_points: { width: 600, height: 400 },
  tco_comparison: { width: 600, height: 400 },
  step_roadmap: { width: 600, height: 250 },
  revenue_model: { width: 600, height: 400 },
  org_chart: { width: 600, height: 400 },
  ecosystem_map: { width: 600, height: 500 },
  esg_cards: { width: 600, height: 400 },
};

export function getChartSize(chartType: string) {
  return CHART_SIZES[chartType] || { width: 600, height: 400 };
}

// ===== SVG 유틸리티 =====

function stripEmoji(str: string): string {
  // 이모지/서로게이트 쌍 제거 (Pango 이모지 폰트 크래시 방지)
  return str.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, "").trim();
}

function escapeXml(str: string): string {
  return stripEmoji(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatNumber(n: number): string {
  if (n >= 100000000) return `${(n / 100000000).toFixed(1)}억`;
  if (n >= 10000) return `${(n / 10000).toFixed(1)}만`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
}

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 2) + "..";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function svgArcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

function svgHeader(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family: 'Noto Sans KR', 'Malgun Gothic', sans-serif;">`;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ===== 진입점 =====

export function renderChartToSvg(chart: ChartDataItem, templateType?: string): string {
  const theme = getThemeForTemplate(templateType);
  const size = getChartSize(chart.type);
  const opts: SvgRenderOptions = { width: size.width, height: size.height, theme };

  switch (chart.type) {
    case "bar": return renderBar(chart, opts);
    case "pie": return renderPie(chart, opts);
    case "line": return renderLine(chart, opts);
    case "tam_sam_som": return renderTamSamSom(chart, opts);
    case "comparison_table": return renderComparisonTable(chart, opts);
    case "timeline": return renderTimeline(chart, opts);
    case "highlight_cards": return renderHighlightCards(chart, opts);
    case "pain_points": return renderPainPoints(chart, opts);
    case "tco_comparison": return renderTcoComparison(chart, opts);
    case "step_roadmap": return renderStepRoadmap(chart, opts);
    case "revenue_model": return renderRevenueModel(chart, opts);
    case "org_chart": return renderOrgChart(chart, opts);
    case "ecosystem_map": return renderEcosystemMap(chart, opts);
    case "esg_cards": return renderEsgCards(chart, opts);
    default: return renderFallback(chart, opts);
  }
}

// ===== 개별 차트 렌더러 =====

function renderTitle(title: string, opts: SvgRenderOptions): string {
  return `<text x="${opts.width / 2}" y="28" text-anchor="middle" font-size="16" font-weight="bold" fill="${opts.theme.textDark}">${escapeXml(title)}</text>`;
}

/** bar: 수직 막대 + Y축 그리드 + 값 레이블 */
function renderBar(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    values?: number[];
    datasets?: Array<{ label: string; values: number[] }>;
    unit?: string;
  };

  const labels = data.labels || [];
  const datasets = data.datasets || (data.values ? [{ label: "", values: data.values }] : []);
  if (labels.length === 0 || datasets.length === 0) return renderFallback(chart, opts);

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const chartLeft = 70;
  const chartRight = width - 30;
  const chartTop = 50;
  const chartBottom = height - 60;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  const groupW = chartW / labels.length;
  const barCount = datasets.length;
  const barW = Math.min(groupW * 0.7 / barCount, 50);
  const barGap = 4;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // Y축 그리드
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH * i) / 4;
    const val = maxVal * (1 - i / 4);
    svg += `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    svg += `<text x="${chartLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${theme.textLight}">${formatNumber(val)}</text>`;
  }

  // 막대
  labels.forEach((label, i) => {
    const groupX = chartLeft + groupW * i;
    const totalBarsW = barW * barCount + barGap * (barCount - 1);
    const startX = groupX + (groupW - totalBarsW) / 2;

    datasets.forEach((ds, di) => {
      const val = ds.values[i] || 0;
      const barH = (val / maxVal) * chartH;
      const x = startX + di * (barW + barGap);
      const y = chartBottom - barH;
      const color = theme.chartColors[di % theme.chartColors.length];

      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="${color}" rx="3"/>`;
      if (barH > 20) {
        svg += `<text x="${x + barW / 2}" y="${y - 5}" text-anchor="middle" font-size="10" fill="${theme.textDark}">${formatNumber(val)}</text>`;
      }
    });

    // X축 라벨
    svg += `<text x="${groupX + groupW / 2}" y="${chartBottom + 18}" text-anchor="middle" font-size="11" fill="${theme.textLight}">${escapeXml(truncateText(label, 8))}</text>`;
  });

  // X축 라인
  svg += `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="${theme.gridColor}" stroke-width="1"/>`;

  // 범례 (다중 데이터셋인 경우)
  if (datasets.length > 1) {
    const legendY = height - 20;
    let legendX = chartLeft;
    datasets.forEach((ds, di) => {
      const color = theme.chartColors[di % theme.chartColors.length];
      svg += `<rect x="${legendX}" y="${legendY - 8}" width="12" height="12" fill="${color}" rx="2"/>`;
      svg += `<text x="${legendX + 16}" y="${legendY + 2}" font-size="11" fill="${theme.textLight}">${escapeXml(truncateText(ds.label, 12))}</text>`;
      legendX += ds.label.length * 8 + 30;
    });
  }

  svg += "</svg>";
  return svg;
}

/** pie: SVG arc + 우측 범례 + 비율 */
function renderPie(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    values?: number[];
    items?: Array<{ name: string; value: number }>;
  };

  let labels: string[];
  let values: number[];

  if (data.items && data.items.length > 0) {
    labels = data.items.map((i) => i.name);
    values = data.items.map((i) => i.value);
  } else if (data.labels && data.values) {
    labels = data.labels;
    values = data.values;
  } else {
    return renderFallback(chart, opts);
  }

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return renderFallback(chart, opts);

  const cx = width * 0.35;
  const cy = height * 0.55;
  const r = Math.min(width * 0.28, height * 0.38);

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  let startAngle = 0;
  const slices: Array<{ label: string; pct: number; color: string; midAngle: number }> = [];

  labels.forEach((label, i) => {
    const pct = (values[i] / total) * 100;
    const angle = (values[i] / total) * 360;
    const endAngle = startAngle + angle;
    const color = theme.chartColors[i % theme.chartColors.length];
    const midAngle = startAngle + angle / 2;

    if (angle >= 359.99) {
      svg += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`;
    } else {
      const start = polarToCartesian(cx, cy, r, endAngle);
      const end = polarToCartesian(cx, cy, r, startAngle);
      const largeArc = angle > 180 ? 1 : 0;
      svg += `<path d="M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} Z" fill="${color}"/>`;
    }

    slices.push({ label, pct, color, midAngle });
    startAngle = endAngle;
  });

  // 비율 레이블 (파이 위)
  slices.forEach((s) => {
    if (s.pct >= 5) {
      const labelR = r * 0.65;
      const pos = polarToCartesian(cx, cy, labelR, s.midAngle);
      svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold" fill="white">${s.pct.toFixed(0)}%</text>`;
    }
  });

  // 우측 범례
  const legendX = width * 0.68;
  let legendY = height * 0.25;

  slices.forEach((s) => {
    svg += `<rect x="${legendX}" y="${legendY - 6}" width="14" height="14" fill="${s.color}" rx="3"/>`;
    svg += `<text x="${legendX + 20}" y="${legendY + 5}" font-size="12" fill="${theme.textDark}">${escapeXml(truncateText(s.label, 10))} (${s.pct.toFixed(1)}%)</text>`;
    legendY += 24;
  });

  svg += "</svg>";
  return svg;
}

/** line: polyline + 원형 마커 + 반투명 영역 */
function renderLine(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    values?: number[];
    datasets?: Array<{ label: string; values: number[] }>;
    unit?: string;
  };

  const labels = data.labels || [];
  const datasets = data.datasets || (data.values ? [{ label: "", values: data.values }] : []);
  if (labels.length === 0 || datasets.length === 0) return renderFallback(chart, opts);

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const chartLeft = 70;
  const chartRight = width - 30;
  const chartTop = 50;
  const chartBottom = height - 60;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // Y축 그리드
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH * i) / 4;
    const val = maxVal - (range * i) / 4;
    svg += `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    svg += `<text x="${chartLeft - 8}" y="${y + 4}" text-anchor="end" font-size="11" fill="${theme.textLight}">${formatNumber(val)}</text>`;
  }

  // 각 데이터셋
  datasets.forEach((ds, di) => {
    const color = theme.chartColors[di % theme.chartColors.length];
    const points: string[] = [];
    const areaPoints: string[] = [];

    labels.forEach((_, i) => {
      const x = chartLeft + (chartW * i) / (labels.length - 1 || 1);
      const val = ds.values[i] || 0;
      const y = chartBottom - ((val - minVal) / range) * chartH;
      points.push(`${x},${y}`);
      areaPoints.push(`${x},${y}`);
    });

    // 영역 채우기
    const areaPath = `M ${chartLeft},${chartBottom} L ${areaPoints.join(" L ")} L ${chartLeft + (chartW * (labels.length - 1)) / (labels.length - 1 || 1)},${chartBottom} Z`;
    svg += `<path d="${areaPath}" fill="${hexToRgba(color, 0.1)}"/>`;

    // 라인
    svg += `<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5"/>`;

    // 마커 + 값
    labels.forEach((_, i) => {
      const x = chartLeft + (chartW * i) / (labels.length - 1 || 1);
      const val = ds.values[i] || 0;
      const y = chartBottom - ((val - minVal) / range) * chartH;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="white" stroke="${color}" stroke-width="2"/>`;
      svg += `<text x="${x}" y="${y - 10}" text-anchor="middle" font-size="10" fill="${theme.textDark}">${formatNumber(val)}</text>`;
    });
  });

  // X축 라벨
  labels.forEach((label, i) => {
    const x = chartLeft + (chartW * i) / (labels.length - 1 || 1);
    svg += `<text x="${x}" y="${chartBottom + 18}" text-anchor="middle" font-size="11" fill="${theme.textLight}">${escapeXml(truncateText(label, 8))}</text>`;
  });

  // 범례
  if (datasets.length > 1) {
    const legendY = height - 20;
    let legendX = chartLeft;
    datasets.forEach((ds, di) => {
      const color = theme.chartColors[di % theme.chartColors.length];
      svg += `<line x1="${legendX}" y1="${legendY - 2}" x2="${legendX + 16}" y2="${legendY - 2}" stroke="${color}" stroke-width="2"/>`;
      svg += `<circle cx="${legendX + 8}" cy="${legendY - 2}" r="3" fill="${color}"/>`;
      svg += `<text x="${legendX + 22}" y="${legendY + 2}" font-size="11" fill="${theme.textLight}">${escapeXml(ds.label)}</text>`;
      legendX += ds.label.length * 8 + 36;
    });
  }

  svg += "</svg>";
  return svg;
}

/** tam_sam_som: 동심원 3개 */
function renderTamSamSom(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { tam?: string; sam?: string; som?: string; cagr?: string };

  const cx = width * 0.4;
  const cy = height * 0.5;
  const rTam = Math.min(width, height) * 0.35;
  const rSam = rTam * 0.65;
  const rSom = rTam * 0.35;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // 동심원
  svg += `<circle cx="${cx}" cy="${cy}" r="${rTam}" fill="${hexToRgba(theme.chartColors[0], 0.15)}" stroke="${theme.chartColors[0]}" stroke-width="2"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rSam}" fill="${hexToRgba(theme.chartColors[1], 0.2)}" stroke="${theme.chartColors[1]}" stroke-width="2"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rSom}" fill="${hexToRgba(theme.chartColors[2], 0.3)}" stroke="${theme.chartColors[2]}" stroke-width="2"/>`;

  // 라벨
  svg += `<text x="${cx}" y="${cy - rTam + 22}" text-anchor="middle" font-size="13" font-weight="bold" fill="${theme.chartColors[0]}">TAM</text>`;
  svg += `<text x="${cx}" y="${cy - rSam + 20}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.chartColors[1]}">SAM</text>`;
  svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.chartColors[2]}">SOM</text>`;
  svg += `<text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="10" fill="${theme.textDark}">${escapeXml(data.som || "")}</text>`;

  // 우측 설명
  const descX = width * 0.7;
  let descY = height * 0.25;
  const items = [
    { label: "TAM", value: data.tam || "", color: theme.chartColors[0], desc: "전체 시장" },
    { label: "SAM", value: data.sam || "", color: theme.chartColors[1], desc: "유효 시장" },
    { label: "SOM", value: data.som || "", color: theme.chartColors[2], desc: "목표 시장" },
  ];
  items.forEach((item) => {
    svg += `<rect x="${descX - 4}" y="${descY - 12}" width="8" height="8" fill="${item.color}" rx="2"/>`;
    svg += `<text x="${descX + 10}" y="${descY - 4}" font-size="11" font-weight="bold" fill="${theme.textDark}">${item.label}</text>`;
    svg += `<text x="${descX + 10}" y="${descY + 12}" font-size="12" fill="${item.color}">${escapeXml(item.value)}</text>`;
    svg += `<text x="${descX + 10}" y="${descY + 26}" font-size="10" fill="${theme.textLight}">${item.desc}</text>`;
    descY += 52;
  });

  if (data.cagr) {
    svg += `<text x="${descX + 10}" y="${descY + 6}" font-size="11" fill="${theme.positive}">CAGR: ${escapeXml(data.cagr)}</text>`;
  }

  svg += "</svg>";
  return svg;
}

/** comparison_table: 헤더 색상 행 + 교대 배경색 */
function renderComparisonTable(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { headers?: string[]; rows?: string[][] };
  const headers = data.headers || [];
  const rows = data.rows || [];
  if (headers.length === 0) return renderFallback(chart, opts);

  const rowH = 32;
  const neededHeight = 50 + (rows.length + 1) * rowH + 20;
  const h = Math.max(height, neededHeight);
  const colW = (width - 40) / headers.length;

  let svg = svgHeader(width, h);
  svg += `<rect width="${width}" height="${h}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, { ...opts, height: h });

  const tableY = 48;

  // 헤더 행
  svg += `<rect x="20" y="${tableY}" width="${width - 40}" height="${rowH}" fill="${theme.headerBg}" rx="4"/>`;
  headers.forEach((h, i) => {
    svg += `<text x="${20 + colW * i + colW / 2}" y="${tableY + 21}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.headerText}">${escapeXml(truncateText(h, 14))}</text>`;
  });

  // 데이터 행
  rows.forEach((row, ri) => {
    const y = tableY + rowH * (ri + 1);
    const fill = ri % 2 === 0 ? "white" : theme.background;
    svg += `<rect x="20" y="${y}" width="${width - 40}" height="${rowH}" fill="${fill}"/>`;
    row.forEach((cell, ci) => {
      if (ci < headers.length) {
        svg += `<text x="${20 + colW * ci + colW / 2}" y="${y + 21}" text-anchor="middle" font-size="11" fill="${theme.textDark}">${escapeXml(truncateText(cell, 16))}</text>`;
      }
    });
    // 행 구분선
    svg += `<line x1="20" y1="${y + rowH}" x2="${width - 20}" y2="${y + rowH}" stroke="${theme.gridColor}" stroke-width="0.5"/>`;
  });

  svg += "</svg>";
  return svg;
}

/** timeline: 수평 축 + 원형 마커 + 상/하 레이블 */
function renderTimeline(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { events?: Array<{ date: string; event: string }> };
  const events = data.events || [];
  if (events.length === 0) return renderFallback(chart, opts);

  const lineY = height * 0.5;
  const startX = 60;
  const endX = width - 60;
  const gap = events.length > 1 ? (endX - startX) / (events.length - 1) : 0;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // 수평 축 라인
  svg += `<line x1="${startX}" y1="${lineY}" x2="${endX}" y2="${lineY}" stroke="${theme.primary}" stroke-width="3" stroke-linecap="round"/>`;

  events.forEach((ev, i) => {
    const x = events.length === 1 ? (startX + endX) / 2 : startX + gap * i;

    // 마커
    svg += `<circle cx="${x}" cy="${lineY}" r="8" fill="white" stroke="${theme.primary}" stroke-width="3"/>`;
    svg += `<circle cx="${x}" cy="${lineY}" r="4" fill="${theme.primary}"/>`;

    // 상/하 교대 배치
    if (i % 2 === 0) {
      svg += `<text x="${x}" y="${lineY - 22}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.primary}">${escapeXml(ev.date)}</text>`;
      svg += `<text x="${x}" y="${lineY - 38}" text-anchor="middle" font-size="10" fill="${theme.textDark}">${escapeXml(truncateText(ev.event, 14))}</text>`;
      svg += `<line x1="${x}" y1="${lineY - 8}" x2="${x}" y2="${lineY - 16}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    } else {
      svg += `<text x="${x}" y="${lineY + 30}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.primary}">${escapeXml(ev.date)}</text>`;
      svg += `<text x="${x}" y="${lineY + 46}" text-anchor="middle" font-size="10" fill="${theme.textDark}">${escapeXml(truncateText(ev.event, 14))}</text>`;
      svg += `<line x1="${x}" y1="${lineY + 8}" x2="${x}" y2="${lineY + 18}" stroke="${theme.gridColor}" stroke-width="1"/>`;
    }
  });

  svg += "</svg>";
  return svg;
}

/** highlight_cards: 수평 KPI 카드 */
function renderHighlightCards(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { items?: Array<{ icon?: string; label: string; value: string }>; cards?: Array<{ icon?: string; label: string; value: string }> };
  const items = data.items || data.cards || [];
  if (items.length === 0) return renderFallback(chart, opts);

  const cardCount = Math.min(items.length, 4);
  const cardGap = 16;
  const totalGap = cardGap * (cardCount - 1);
  const cardW = (width - 40 - totalGap) / cardCount;
  const cardH = height - 60;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  items.slice(0, 4).forEach((item, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 46;
    const color = theme.chartColors[i % theme.chartColors.length];

    // 카드 배경
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="${hexToRgba(color, 0.08)}" rx="8" stroke="${color}" stroke-width="1.5"/>`;

    // 아이콘 (컬러 원으로 대체 — 이모지 폰트 미지원 환경 호환)
    svg += `<circle cx="${x + cardW / 2}" cy="${y + 28}" r="12" fill="${hexToRgba(color, 0.2)}"/>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 33}" text-anchor="middle" font-size="12" font-weight="bold" fill="${color}">${i + 1}</text>`;

    // 값
    svg += `<text x="${x + cardW / 2}" y="${y + cardH / 2 + 10}" text-anchor="middle" font-size="18" font-weight="bold" fill="${color}">${escapeXml(truncateText(item.value, 10))}</text>`;

    // 라벨
    svg += `<text x="${x + cardW / 2}" y="${y + cardH - 16}" text-anchor="middle" font-size="11" fill="${theme.textLight}">${escapeXml(truncateText(item.label, 10))}</text>`;
  });

  svg += "</svg>";
  return svg;
}

/** pain_points: 아이콘 원 + 제목 + 수치 + 설명 */
function renderPainPoints(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { points?: Array<{ icon: string; title: string; value: string; description: string }> };
  const points = data.points || [];
  if (points.length === 0) return renderFallback(chart, opts);

  const count = Math.min(points.length, 4);
  const cardW = (width - 40 - 16 * (count - 1)) / count;
  const cardH = height - 70;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  points.slice(0, 4).forEach((p, i) => {
    const x = 20 + i * (cardW + 16);
    const y = 50;

    // 카드 배경
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="${hexToRgba(theme.negative, 0.05)}" rx="8" stroke="${hexToRgba(theme.negative, 0.3)}" stroke-width="1"/>`;

    // 아이콘 원 (이모지 대신 번호 표시)
    svg += `<circle cx="${x + cardW / 2}" cy="${y + 40}" r="22" fill="${hexToRgba(theme.negative, 0.15)}"/>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 46}" text-anchor="middle" font-size="14" font-weight="bold" fill="${theme.negative}">${i + 1}</text>`;

    // 제목
    svg += `<text x="${x + cardW / 2}" y="${y + 80}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(p.title, 12))}</text>`;

    // 수치
    svg += `<text x="${x + cardW / 2}" y="${y + 105}" text-anchor="middle" font-size="16" font-weight="bold" fill="${theme.negative}">${escapeXml(truncateText(p.value, 12))}</text>`;

    // 설명
    const desc = truncateText(p.description, 20);
    svg += `<text x="${x + cardW / 2}" y="${y + 128}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(desc)}</text>`;
  });

  svg += "</svg>";
  return svg;
}

/** tco_comparison: 좌우 비교 수평 막대 + 중앙 절감률 */
function renderTcoComparison(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    before?: { label: string; total: string; items: Array<{ name: string; value: string }> };
    after?: { label: string; total: string; items: Array<{ name: string; value: string }> };
    saving_rate?: string;
  };

  if (!data.before || !data.after) return renderFallback(chart, opts);

  const midX = width / 2;
  const barMaxW = width * 0.32;
  const barH = 28;

  // 숫자 파싱 헬퍼
  const parseVal = (s: string) => {
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const beforeVals = data.before.items.map((i) => parseVal(i.value));
  const afterVals = data.after.items.map((i) => parseVal(i.value));
  const maxV = Math.max(...beforeVals, ...afterVals, 1);
  const count = Math.max(data.before.items.length, data.after.items.length);

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // 헤더
  svg += `<text x="${midX - barMaxW / 2}" y="58" text-anchor="middle" font-size="13" font-weight="bold" fill="${theme.negative}">${escapeXml(data.before.label)}</text>`;
  svg += `<text x="${midX + barMaxW / 2}" y="58" text-anchor="middle" font-size="13" font-weight="bold" fill="${theme.positive}">${escapeXml(data.after.label)}</text>`;

  let y = 72;
  for (let i = 0; i < count; i++) {
    const bItem = data.before.items[i];
    const aItem = data.after.items[i];
    const bVal = bItem ? parseVal(bItem.value) : 0;
    const aVal = aItem ? parseVal(aItem.value) : 0;
    const bW = Math.max((bVal / maxV) * barMaxW, 4);
    const aW = Math.max((aVal / maxV) * barMaxW, 4);
    const label = bItem?.name || aItem?.name || "";

    // 중앙 라벨
    svg += `<text x="${midX}" y="${y + barH / 2 + 4}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(label, 10))}</text>`;

    // 좌측 (before) 막대 - 오른쪽으로 끝맞춤
    svg += `<rect x="${midX - 50 - bW}" y="${y}" width="${bW}" height="${barH}" fill="${hexToRgba(theme.negative, 0.7)}" rx="4"/>`;
    svg += `<text x="${midX - 54 - bW}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="10" fill="${theme.textDark}">${escapeXml(bItem?.value || "")}</text>`;

    // 우측 (after) 막대
    svg += `<rect x="${midX + 50}" y="${y}" width="${aW}" height="${barH}" fill="${hexToRgba(theme.positive, 0.7)}" rx="4"/>`;
    svg += `<text x="${midX + 54 + aW}" y="${y + barH / 2 + 4}" font-size="10" fill="${theme.textDark}">${escapeXml(aItem?.value || "")}</text>`;

    y += barH + 8;
  }

  // 절감률 뱃지
  if (data.saving_rate) {
    const badgeY = height - 50;
    svg += `<rect x="${midX - 60}" y="${badgeY}" width="120" height="36" fill="${theme.positive}" rx="18"/>`;
    svg += `<text x="${midX}" y="${badgeY + 23}" text-anchor="middle" font-size="14" font-weight="bold" fill="white">${escapeXml(data.saving_rate)} 절감</text>`;
  }

  svg += "</svg>";
  return svg;
}

/** step_roadmap: 수평 단계 사각형 + 화살표 */
function renderStepRoadmap(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { steps?: Array<{ step: number; title: string; period?: string; target?: string; goal?: string }> };
  const steps = data.steps || [];
  if (steps.length === 0) return renderFallback(chart, opts);

  const count = steps.length;
  const stepW = Math.min((width - 40 - (count - 1) * 28) / count, 140);
  const stepH = height - 80;
  const totalW = count * stepW + (count - 1) * 28;
  const startX = (width - totalW) / 2;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  steps.forEach((s, i) => {
    const x = startX + i * (stepW + 28);
    const y = 50;
    const color = theme.chartColors[i % theme.chartColors.length];

    // 사각형
    svg += `<rect x="${x}" y="${y}" width="${stepW}" height="${stepH}" fill="${hexToRgba(color, 0.1)}" rx="8" stroke="${color}" stroke-width="2"/>`;

    // 단계 번호 원
    svg += `<circle cx="${x + stepW / 2}" cy="${y + 24}" r="14" fill="${color}"/>`;
    svg += `<text x="${x + stepW / 2}" y="${y + 29}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${s.step}</text>`;

    // 제목
    svg += `<text x="${x + stepW / 2}" y="${y + 56}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(s.title, 10))}</text>`;

    // 기간
    if (s.period) {
      svg += `<text x="${x + stepW / 2}" y="${y + 74}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(s.period, 12))}</text>`;
    }

    // 목표
    if (s.goal) {
      svg += `<text x="${x + stepW / 2}" y="${y + stepH - 16}" text-anchor="middle" font-size="9" fill="${color}">${escapeXml(truncateText(s.goal, 14))}</text>`;
    }

    // 화살표 (마지막 빼고)
    if (i < count - 1) {
      const arrowX = x + stepW + 4;
      const arrowY = y + stepH / 2;
      svg += `<polygon points="${arrowX},${arrowY - 6} ${arrowX + 20},${arrowY} ${arrowX},${arrowY + 6}" fill="${theme.primary}"/>`;
    }
  });

  svg += "</svg>";
  return svg;
}

/** revenue_model: 프라이싱 카드 */
function renderRevenueModel(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { tracks?: Array<{ name: string; subtitle: string; price: string; features: string[] }> };
  const tracks = data.tracks || [];
  if (tracks.length === 0) return renderFallback(chart, opts);

  const count = Math.min(tracks.length, 3);
  const cardGap = 20;
  const cardW = (width - 40 - cardGap * (count - 1)) / count;
  const cardH = height - 70;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  tracks.slice(0, 3).forEach((t, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 50;
    const color = theme.chartColors[i % theme.chartColors.length];
    const isMiddle = count === 3 && i === 1;

    // 카드 배경 (중간 강조)
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="${isMiddle ? hexToRgba(color, 0.08) : "white"}" rx="10" stroke="${color}" stroke-width="${isMiddle ? 2.5 : 1.5}"/>`;

    // 헤더 배경
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="50" fill="${color}" rx="10"/>`;
    svg += `<rect x="${x}" y="${y + 40}" width="${cardW}" height="10" fill="${color}"/>`;

    // 이름
    svg += `<text x="${x + cardW / 2}" y="${y + 25}" text-anchor="middle" font-size="13" font-weight="bold" fill="white">${escapeXml(truncateText(t.name, 14))}</text>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 42}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.8)">${escapeXml(truncateText(t.subtitle, 16))}</text>`;

    // 가격
    svg += `<text x="${x + cardW / 2}" y="${y + 80}" text-anchor="middle" font-size="18" font-weight="bold" fill="${color}">${escapeXml(t.price)}</text>`;

    // 기능
    t.features.slice(0, 5).forEach((f, fi) => {
      svg += `<text x="${x + 16}" y="${y + 108 + fi * 20}" font-size="10" fill="${theme.textDark}">&#x2713; ${escapeXml(truncateText(f, 18))}</text>`;
    });
  });

  svg += "</svg>";
  return svg;
}

/** org_chart: 트리 레이아웃 */
function renderOrgChart(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { members?: Array<{ role: string; name: string; title: string; detail?: string }> };
  const members = data.members || [];
  if (members.length === 0) return renderFallback(chart, opts);

  const boxW = 120;
  const boxH = 56;
  const topY = 56;
  const bottomY = height * 0.55;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // 대표 (첫 번째)
  const topX = width / 2 - boxW / 2;
  svg += `<rect x="${topX}" y="${topY}" width="${boxW}" height="${boxH}" fill="${theme.primary}" rx="8"/>`;
  svg += `<text x="${width / 2}" y="${topY + 22}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">${escapeXml(truncateText(members[0].name, 8))}</text>`;
  svg += `<text x="${width / 2}" y="${topY + 40}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.85)">${escapeXml(truncateText(members[0].title, 12))}</text>`;

  // 하위 멤버
  const subs = members.slice(1);
  if (subs.length > 0) {
    const subCount = Math.min(subs.length, 5);
    const totalSubW = subCount * boxW + (subCount - 1) * 20;
    const subStartX = (width - totalSubW) / 2;

    // 연결선
    svg += `<line x1="${width / 2}" y1="${topY + boxH}" x2="${width / 2}" y2="${(topY + boxH + bottomY) / 2}" stroke="${theme.gridColor}" stroke-width="2"/>`;
    svg += `<line x1="${subStartX + boxW / 2}" y1="${(topY + boxH + bottomY) / 2}" x2="${subStartX + (subCount - 1) * (boxW + 20) + boxW / 2}" y2="${(topY + boxH + bottomY) / 2}" stroke="${theme.gridColor}" stroke-width="2"/>`;

    subs.slice(0, 5).forEach((m, i) => {
      const x = subStartX + i * (boxW + 20);
      const color = theme.chartColors[(i + 1) % theme.chartColors.length];

      // 수직 연결선
      svg += `<line x1="${x + boxW / 2}" y1="${(topY + boxH + bottomY) / 2}" x2="${x + boxW / 2}" y2="${bottomY}" stroke="${theme.gridColor}" stroke-width="2"/>`;

      // 박스
      svg += `<rect x="${x}" y="${bottomY}" width="${boxW}" height="${boxH}" fill="${hexToRgba(color, 0.1)}" rx="8" stroke="${color}" stroke-width="1.5"/>`;
      svg += `<text x="${x + boxW / 2}" y="${bottomY + 22}" text-anchor="middle" font-size="10" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(m.name, 8))}</text>`;
      svg += `<text x="${x + boxW / 2}" y="${bottomY + 40}" text-anchor="middle" font-size="9" fill="${theme.textLight}">${escapeXml(truncateText(m.title, 12))}</text>`;
    });
  }

  svg += "</svg>";
  return svg;
}

/** ecosystem_map: 중앙 허브 + 방사형 노드 */
function renderEcosystemMap(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { center?: string; partners?: Array<{ name: string; role: string; detail?: string }> };
  const partners = data.partners || [];
  const center = data.center || "Core";

  const cx = width / 2;
  const cy = height * 0.52;
  const hubR = 44;
  const orbitR = Math.min(width, height) * 0.32;
  const nodeR = 32;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  // 연결선
  const count = Math.min(partners.length, 8);
  partners.slice(0, 8).forEach((_, i) => {
    const angle = (360 / count) * i - 90;
    const pos = polarToCartesian(cx, cy, orbitR, angle);
    svg += `<line x1="${cx}" y1="${cy}" x2="${pos.x}" y2="${pos.y}" stroke="${theme.gridColor}" stroke-width="1.5" stroke-dasharray="4,4"/>`;
  });

  // 허브
  svg += `<circle cx="${cx}" cy="${cy}" r="${hubR}" fill="${theme.primary}"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">${escapeXml(truncateText(center, 8))}</text>`;

  // 파트너 노드
  partners.slice(0, 8).forEach((p, i) => {
    const angle = (360 / count) * i - 90;
    const pos = polarToCartesian(cx, cy, orbitR, angle);
    const color = theme.chartColors[i % theme.chartColors.length];

    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeR}" fill="${hexToRgba(color, 0.15)}" stroke="${color}" stroke-width="2"/>`;
    svg += `<text x="${pos.x}" y="${pos.y - 2}" text-anchor="middle" font-size="9" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(p.name, 8))}</text>`;
    svg += `<text x="${pos.x}" y="${pos.y + 12}" text-anchor="middle" font-size="8" fill="${theme.textLight}">${escapeXml(truncateText(p.role, 8))}</text>`;
  });

  svg += "</svg>";
  return svg;
}

/** esg_cards: 3컬럼 E/S/G 카드 */
function renderEsgCards(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    environment?: { title?: string; items: string[] };
    social?: { title?: string; items: string[] };
    governance?: { title?: string; items: string[] };
  };

  const columns = [
    { key: "E", title: data.environment?.title || "Environment", items: data.environment?.items || [], color: "#22C55E" },
    { key: "S", title: data.social?.title || "Social", items: data.social?.items || [], color: "#3B82F6" },
    { key: "G", title: data.governance?.title || "Governance", items: data.governance?.items || [], color: "#6B7280" },
  ];

  const cardGap = 16;
  const cardW = (width - 40 - cardGap * 2) / 3;
  const cardH = height - 70;

  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);

  columns.forEach((col, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 50;

    // 카드
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="${hexToRgba(col.color, 0.05)}" rx="10" stroke="${col.color}" stroke-width="1.5"/>`;

    // 헤더
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="40" fill="${col.color}" rx="10"/>`;
    svg += `<rect x="${x}" y="${y + 30}" width="${cardW}" height="10" fill="${col.color}"/>`;

    // 아이콘 + 제목
    svg += `<text x="${x + cardW / 2}" y="${y + 26}" text-anchor="middle" font-size="13" font-weight="bold" fill="white">${escapeXml(col.title)}</text>`;

    // 항목
    col.items.slice(0, 6).forEach((item, ii) => {
      svg += `<circle cx="${x + 18}" cy="${y + 62 + ii * 22}" r="3" fill="${col.color}"/>`;
      svg += `<text x="${x + 28}" y="${y + 66 + ii * 22}" font-size="10" fill="${theme.textDark}">${escapeXml(truncateText(item, 18))}</text>`;
    });
  });

  svg += "</svg>";
  return svg;
}

/** 폴백: 제목 + 데이터 없음 메시지 */
function renderFallback(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="8"/>`;
  svg += renderTitle(chart.title, opts);
  svg += `<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-size="13" fill="${theme.textLight}">[${escapeXml(chart.type)}] 데이터 표시 불가</text>`;
  svg += "</svg>";
  return svg;
}
