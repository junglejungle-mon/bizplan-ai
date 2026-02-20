/**
 * 14개 차트 타입 SVG 렌더러 — 인포그래픽 스타일
 * DOM/canvas 없이 순수 문자열로 SVG 생성
 * librsvg(sharp) 호환: feDropShadow 미지원 → feGaussianBlur+feOffset+feMerge
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ChartTheme, getThemeForTemplate } from "./themes";

// ===== 차트 데이터 인터페이스 =====
export interface ChartDataItem {
  type: string;
  title: string;
  data: Record<string, unknown>;
}

export interface SvgRenderOptions {
  width: number;
  height: number;
  theme: ChartTheme;
  scale?: number;
}

// ===== 차트 크기 규격 =====
const CHART_SIZES: Record<string, { width: number; height: number }> = {
  bar: { width: 600, height: 400 },
  pie: { width: 600, height: 400 },
  line: { width: 600, height: 400 },
  tam_sam_som: { width: 600, height: 500 },
  comparison_table: { width: 600, height: 400 },
  timeline: { width: 600, height: 280 },
  highlight_cards: { width: 600, height: 220 },
  pain_points: { width: 600, height: 400 },
  tco_comparison: { width: 600, height: 400 },
  step_roadmap: { width: 600, height: 270 },
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
  return String(str || "").replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FE0F}]|[\u{200D}]|[\u{20E3}]|[\u{E0020}-\u{E007F}]/gu, "").trim();
}

function escapeXml(str: string): string {
  return stripEmoji(String(str || ""))
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

function truncateText(text: string | unknown, maxLen: number): string {
  const s = String(text ?? "");
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 2) + "..";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** 색상 밝게 (그라데이션 상단) */
function lightenHex(hex: string, pct: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + Math.round(255 * pct));
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + Math.round(255 * pct));
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + Math.round(255 * pct));
  return `rgb(${r},${g},${b})`;
}

// ===== 한글 폰트 Base64 캐시 (SVG 임베드용) =====
let _svgFontBase64: string | null = null;

function getSvgFontBase64(): string {
  if (!_svgFontBase64) {
    try {
      const fontPath = join(process.cwd(), "src", "lib", "fonts", "NotoSansKR-Regular.ttf");
      _svgFontBase64 = readFileSync(fontPath).toString("base64");
    } catch {
      _svgFontBase64 = ""; // 폰트 파일 없으면 시스템 폰트 fallback
    }
  }
  return _svgFontBase64;
}

// ===== 공통 SVG defs =====

function svgHeader(width: number, height: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="font-family: 'NotoSansKR', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif;">`;
}

/** librsvg 호환 그림자 필터 + 한글 폰트 @font-face 임베드 */
function svgDefs(): string {
  const fontB64 = getSvgFontBase64();
  const fontFace = fontB64
    ? `<style>@font-face { font-family: 'NotoSansKR'; src: url('data:font/truetype;base64,${fontB64}') format('truetype'); font-weight: normal; font-style: normal; }</style>`
    : "";

  return `<defs>
${fontFace}
<filter id="shadow" x="-6%" y="-6%" width="112%" height="120%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
  <feOffset dx="0" dy="2" result="shifted"/>
  <feFlood flood-color="black" flood-opacity="0.08" result="color"/>
  <feComposite in="color" in2="shifted" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
<filter id="shadow-sm" x="-4%" y="-4%" width="108%" height="112%">
  <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
  <feOffset dx="0" dy="1" result="shifted"/>
  <feFlood flood-color="black" flood-opacity="0.06" result="color"/>
  <feComposite in="color" in2="shifted" operator="in" result="shadow"/>
  <feMerge><feMergeNode in="shadow"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
</defs>`;
}

/** 동적 그라데이션 생성 */
function linearGradientDef(id: string, color: string, direction: "vertical" | "horizontal" = "vertical"): string {
  const x2 = direction === "horizontal" ? "100%" : "0%";
  const y2 = direction === "horizontal" ? "0%" : "100%";
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="${x2}" y2="${y2}">
  <stop offset="0%" stop-color="${lightenHex(color, 0.15)}"/>
  <stop offset="100%" stop-color="${color}"/>
</linearGradient>`;
}

function radialGradientDef(id: string, color: string): string {
  return `<radialGradient id="${id}" cx="40%" cy="40%" r="60%">
  <stop offset="0%" stop-color="${lightenHex(color, 0.25)}"/>
  <stop offset="100%" stop-color="${color}"/>
</radialGradient>`;
}

function areaGradientDef(id: string, color: string): string {
  return `<linearGradient id="${id}" x1="0%" y1="0%" x2="0%" y2="100%">
  <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
  <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
</linearGradient>`;
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

// ===== 공통 렌더링 =====

function renderTitle(title: string, opts: SvgRenderOptions): string {
  const { theme } = opts;
  const x = opts.width / 2;
  return `<text x="${x}" y="26" text-anchor="middle" font-size="15" font-weight="bold" fill="${theme.primary}">${escapeXml(title)}</text>`;
}

// ===== bar: 인포그래픽 막대 차트 =====

function renderBar(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    categories?: string[];
    values?: number[];
    datasets?: Array<{ label: string; values: number[] }>;
    series?: Array<{ name: string; values: number[]; unit?: string }>;
    unit?: string;
  };

  // 다양한 AI 데이터 형식 호환
  let labels = data.labels || data.categories || [];
  let datasets = data.datasets || (data.series ? data.series.map((s) => ({ label: s.name, values: s.values })) : (data.values ? [{ label: "", values: data.values }] : []));

  // 커스텀 키 이름 형식: { channels: [...], revenue: [...] } 또는 { products: [...], target_rate: [...] }
  // labels가 있어도 datasets가 없으면 숫자 배열을 자동 감지
  if (datasets.length === 0) {
    const raw = data as Record<string, unknown>;
    // 문자열 배열 키를 labels로, 숫자 배열 키를 datasets로 자동 감지
    const skipKeys = new Set(["unit", "color_scheme", "total", "labels", "categories", "datasets", "series", "values"]);
    const allKeys = Object.keys(raw).filter((k) => !skipKeys.has(k));
    const numArrayKeys = allKeys.filter((k) => Array.isArray(raw[k]) && (raw[k] as unknown[]).length > 0 && typeof (raw[k] as unknown[])[0] === "number");

    if (labels.length === 0) {
      const strArrayKey = allKeys.find((k) => Array.isArray(raw[k]) && (raw[k] as unknown[]).length > 0 && typeof (raw[k] as unknown[])[0] === "string");
      if (strArrayKey) labels = raw[strArrayKey] as string[];
    }

    if (numArrayKeys.length > 0) {
      datasets = numArrayKeys.map((k) => ({
        label: k.replace(/_/g, " "),
        values: raw[k] as number[],
      }));
    }
  }

  // requirements 객체 배열 형식: [{ item, grade, status, ... }]
  if (labels.length === 0 && datasets.length === 0) {
    const raw = data as Record<string, unknown>;
    if (raw.requirements && Array.isArray(raw.requirements)) {
      const reqs = raw.requirements as Array<Record<string, unknown>>;
      labels = reqs.map((r) => String(r.item || r.name || ""));
      // grade에서 숫자 추출
      const vals = reqs.map((r) => {
        const g = String(r.grade || r.value || "0");
        const n = parseFloat(g.replace(/[^0-9.]/g, ""));
        return isNaN(n) ? 0 : n;
      });
      datasets = [{ label: "충족도", values: vals }];
    }
  }

  if (labels.length === 0 || datasets.length === 0) return renderFallback(chart, opts);

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const chartLeft = 70;
  const chartRight = width - 30;
  const chartTop = 48;
  const chartBottom = height - 60;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;
  const groupW = chartW / labels.length;
  const barCount = datasets.length;
  const barW = Math.min(groupW * 0.7 / barCount, 50);
  const barGap = 4;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  // 각 데이터셋에 그라데이션 정의
  datasets.forEach((_, di) => {
    const color = theme.chartColors[di % theme.chartColors.length];
    svg += `<defs>${linearGradientDef(`bar-g${di}`, color)}</defs>`;
  });
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // Y축 그리드 (점선)
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH * i) / 4;
    const val = maxVal * (1 - i / 4);
    svg += `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="4,3"/>`;
    svg += `<text x="${chartLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="${theme.textLight}">${formatNumber(val)}</text>`;
  }

  // 막대
  labels.forEach((label, i) => {
    const groupX = chartLeft + groupW * i;
    const totalBarsW = barW * barCount + barGap * (barCount - 1);
    const startX = groupX + (groupW - totalBarsW) / 2;

    datasets.forEach((ds, di) => {
      const val = (ds.values && i < ds.values.length ? ds.values[i] : 0) || 0;
      const barH = maxVal > 0 ? (val / maxVal) * chartH : 0;
      const x = startX + di * (barW + barGap);
      const y = chartBottom - barH;

      // 그라데이션 막대 + 그림자
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" fill="url(#bar-g${di})" rx="5" filter="url(#shadow-sm)"/>`;

      // 값 레이블 pill
      if (barH > 24) {
        const lbl = formatNumber(val);
        const lblW = lbl.length * 7 + 10;
        svg += `<rect x="${x + barW / 2 - lblW / 2}" y="${y - 22}" width="${lblW}" height="18" rx="9" fill="${theme.chartColors[di % theme.chartColors.length]}" opacity="0.9"/>`;
        svg += `<text x="${x + barW / 2}" y="${y - 10}" text-anchor="middle" font-size="10" font-weight="bold" fill="white">${lbl}</text>`;
      }
    });

    // X축 라벨
    svg += `<text x="${groupX + groupW / 2}" y="${chartBottom + 18}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(label, 8))}</text>`;
  });

  // X축 accent line
  svg += `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="${theme.primary}" stroke-width="2" opacity="0.3"/>`;

  // 범례
  if (datasets.length > 1) {
    const legendY = height - 18;
    let legendX = chartLeft;
    datasets.forEach((ds, di) => {
      const color = theme.chartColors[di % theme.chartColors.length];
      svg += `<rect x="${legendX}" y="${legendY - 8}" width="12" height="12" fill="${color}" rx="3"/>`;
      svg += `<text x="${legendX + 16}" y="${legendY + 2}" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(ds.label, 12))}</text>`;
      legendX += ds.label.length * 7 + 30;
    });
  }

  svg += "</svg>";
  return svg;
}

// ===== pie → 도넛 차트 =====

function renderPie(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    values?: number[];
    items?: Array<{ name?: string; label?: string; value: number }>;
  };

  let labels: string[];
  let values: number[];

  if (data.items && data.items.length > 0) {
    labels = data.items.map((i) => i.label || i.name || "");
    values = data.items.map((i) => i.value);
  } else if (data.labels && data.values) {
    labels = data.labels;
    values = data.values;
  } else {
    return renderFallback(chart, opts);
  }

  const total = values.reduce((s, v) => s + v, 0);
  if (total === 0) return renderFallback(chart, opts);

  const cx = width * 0.33;
  const cy = height * 0.55;
  const outerR = Math.min(width * 0.27, height * 0.36);
  const innerR = outerR * 0.55; // 도넛 내경

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  let startAngle = 0;
  const slices: Array<{ label: string; value: number; pct: number; color: string; midAngle: number }> = [];

  labels.forEach((label, i) => {
    const pct = (values[i] / total) * 100;
    const angle = (values[i] / total) * 360;
    const endAngle = startAngle + angle;
    const color = theme.chartColors[i % theme.chartColors.length];
    const midAngle = startAngle + angle / 2;

    if (angle >= 359.99) {
      // 100% — 도넛 링
      svg += `<circle cx="${cx}" cy="${cy}" r="${outerR}" fill="${color}"/>`;
      svg += `<circle cx="${cx}" cy="${cy}" r="${innerR}" fill="white"/>`;
    } else {
      // 도넛 arc path (외경 → 내경)
      const outerStart = polarToCartesian(cx, cy, outerR, endAngle);
      const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
      const innerStart = polarToCartesian(cx, cy, innerR, startAngle);
      const innerEnd = polarToCartesian(cx, cy, innerR, endAngle);
      const largeArc = angle > 180 ? 1 : 0;

      svg += `<path d="M ${outerStart.x} ${outerStart.y} A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y} L ${innerStart.x} ${innerStart.y} A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerEnd.x} ${innerEnd.y} Z" fill="${color}" stroke="white" stroke-width="2"/>`;
    }

    slices.push({ label, value: values[i], pct, color, midAngle });
    startAngle = endAngle;
  });

  // 중앙 텍스트
  svg += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="10" fill="${theme.textLight}">Total</text>`;
  svg += `<text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="14" font-weight="bold" fill="${theme.textDark}">${formatNumber(total)}</text>`;

  // 비율 레이블 (도넛 위)
  slices.forEach((s) => {
    if (s.pct >= 6) {
      const labelR = (outerR + innerR) / 2;
      const pos = polarToCartesian(cx, cy, labelR, s.midAngle);
      svg += `<text x="${pos.x}" y="${pos.y + 1}" text-anchor="middle" dominant-baseline="middle" font-size="11" font-weight="bold" fill="white">${s.pct.toFixed(0)}%</text>`;
    }
  });

  // 우측 범례 (미니 바 포함)
  const legendX = width * 0.66;
  let legendY = height * 0.22;
  const maxBarW = 60;
  const maxValue = Math.max(...values);

  slices.forEach((s) => {
    svg += `<rect x="${legendX}" y="${legendY - 5}" width="12" height="12" fill="${s.color}" rx="3"/>`;
    svg += `<text x="${legendX + 18}" y="${legendY + 5}" font-size="11" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(s.label, 8))}</text>`;
    svg += `<text x="${legendX + 18}" y="${legendY + 19}" font-size="10" fill="${theme.textLight}">${formatNumber(s.value)}</text>`;
    // 미니 바
    const barW = (s.value / maxValue) * maxBarW;
    svg += `<rect x="${legendX + 80}" y="${legendY + 10}" width="${barW}" height="6" fill="${s.color}" rx="3" opacity="0.6"/>`;
    legendY += 32;
  });

  svg += "</svg>";
  return svg;
}

// ===== line: 부드러운 영역 그래프 =====

function renderLine(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    labels?: string[];
    categories?: string[];
    years?: number[];
    values?: number[];
    datasets?: Array<{ label: string; values: number[] }>;
    series?: Array<{ name: string; values: number[]; unit?: string }>;
  };

  let labels = data.labels || data.categories || (data.years ? data.years.map(String) : []);
  let datasets = data.datasets || (data.series ? data.series.map((s) => ({ label: s.name, values: s.values })) : (data.values ? [{ label: "", values: data.values }] : []));

  // 별도 배열 형식: { years: [...], revenue: [...], profit: [...] }
  if (labels.length === 0 || datasets.length === 0) {
    const raw = data as Record<string, unknown>;
    const allKeys = Object.keys(raw).filter((k) => k !== "unit" && k !== "color_scheme");
    const strOrNumArrayKey = allKeys.find((k) => {
      if (!Array.isArray(raw[k]) || (raw[k] as unknown[]).length === 0) return false;
      const first = (raw[k] as unknown[])[0];
      return typeof first === "string" || (typeof first === "number" && (k === "years" || k === "quarters" || k === "months" || k === "periods"));
    });
    const numArrayKeys = allKeys.filter((k) => {
      if (k === strOrNumArrayKey) return false;
      return Array.isArray(raw[k]) && (raw[k] as unknown[]).length > 0 && typeof (raw[k] as unknown[])[0] === "number";
    });

    if (strOrNumArrayKey && numArrayKeys.length > 0) {
      labels = (raw[strOrNumArrayKey] as unknown[]).map(String);
      datasets = numArrayKeys.map((k) => ({
        label: k.replace(/_/g, " "),
        values: raw[k] as number[],
      }));
    }
  }

  if (labels.length === 0 || datasets.length === 0) return renderFallback(chart, opts);

  const allValues = datasets.flatMap((d) => d.values);
  const maxVal = Math.max(...allValues, 1);
  const minVal = Math.min(...allValues, 0);
  const range = maxVal - minVal || 1;

  const chartLeft = 70;
  const chartRight = width - 30;
  const chartTop = 48;
  const chartBottom = height - 60;
  const chartW = chartRight - chartLeft;
  const chartH = chartBottom - chartTop;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  // 영역 그라데이션 정의
  datasets.forEach((_, di) => {
    const color = theme.chartColors[di % theme.chartColors.length];
    svg += `<defs>${areaGradientDef(`area-g${di}`, color)}</defs>`;
  });
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // Y축 그리드 (점선)
  for (let i = 0; i <= 4; i++) {
    const y = chartTop + (chartH * i) / 4;
    const val = maxVal - (range * i) / 4;
    svg += `<line x1="${chartLeft}" y1="${y}" x2="${chartRight}" y2="${y}" stroke="${theme.gridColor}" stroke-width="1" stroke-dasharray="4,3"/>`;
    svg += `<text x="${chartLeft - 8}" y="${y + 4}" text-anchor="end" font-size="10" fill="${theme.textLight}">${formatNumber(val)}</text>`;
  }

  // 데이터셋
  datasets.forEach((ds, di) => {
    const color = theme.chartColors[di % theme.chartColors.length];
    const points: Array<{ x: number; y: number }> = [];

    labels.forEach((_, i) => {
      const x = chartLeft + (chartW * i) / (labels.length - 1 || 1);
      const val = ds.values[i] || 0;
      const y = chartBottom - ((val - minVal) / range) * chartH;
      points.push({ x, y });
    });

    // 그라데이션 영역 채우기
    const areaPath = `M ${chartLeft},${chartBottom} L ${points.map((p) => `${p.x},${p.y}`).join(" L ")} L ${points[points.length - 1].x},${chartBottom} Z`;
    svg += `<path d="${areaPath}" fill="url(#area-g${di})"/>`;

    // 라인 (두께 3)
    svg += `<polyline points="${points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;

    // 마커 (이중 원 + 값)
    points.forEach((p, i) => {
      const val = ds.values[i] || 0;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="6" fill="${hexToRgba(color, 0.15)}" stroke="none"/>`;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="4" fill="white" stroke="${color}" stroke-width="2.5"/>`;
      svg += `<text x="${p.x}" y="${p.y - 12}" text-anchor="middle" font-size="10" font-weight="bold" fill="${theme.textDark}">${formatNumber(val)}</text>`;
    });
  });

  // X축 라벨
  labels.forEach((label, i) => {
    const x = chartLeft + (chartW * i) / (labels.length - 1 || 1);
    svg += `<text x="${x}" y="${chartBottom + 18}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(label, 8))}</text>`;
  });

  // X축 accent
  svg += `<line x1="${chartLeft}" y1="${chartBottom}" x2="${chartRight}" y2="${chartBottom}" stroke="${theme.primary}" stroke-width="2" opacity="0.3"/>`;

  // 범례
  if (datasets.length > 1) {
    const legendY = height - 18;
    let legendX = chartLeft;
    datasets.forEach((ds, di) => {
      const color = theme.chartColors[di % theme.chartColors.length];
      svg += `<line x1="${legendX}" y1="${legendY - 2}" x2="${legendX + 16}" y2="${legendY - 2}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>`;
      svg += `<circle cx="${legendX + 8}" cy="${legendY - 2}" r="3" fill="${color}"/>`;
      svg += `<text x="${legendX + 22}" y="${legendY + 2}" font-size="10" fill="${theme.textLight}">${escapeXml(ds.label)}</text>`;
      legendX += ds.label.length * 7 + 36;
    });
  }

  svg += "</svg>";
  return svg;
}

// ===== tam_sam_som: 프리미엄 동심원 =====

function renderTamSamSom(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { tam?: string; sam?: string; som?: string; cagr?: string };

  const cx = width * 0.38;
  const cy = height * 0.52;
  const rTam = Math.min(width, height) * 0.34;
  const rSam = rTam * 0.65;
  const rSom = rTam * 0.35;
  const colors = [theme.chartColors[0], theme.chartColors[1], theme.chartColors[2]];

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<defs>${radialGradientDef("tam-rg", colors[0])}${radialGradientDef("sam-rg", colors[1])}${radialGradientDef("som-rg", colors[2])}</defs>`;
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // 동심원 (그라데이션 + 그림자)
  svg += `<circle cx="${cx}" cy="${cy}" r="${rTam}" fill="${hexToRgba(colors[0], 0.1)}" stroke="${colors[0]}" stroke-width="2.5" filter="url(#shadow-sm)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rSam}" fill="${hexToRgba(colors[1], 0.15)}" stroke="${colors[1]}" stroke-width="2.5" filter="url(#shadow-sm)"/>`;
  svg += `<circle cx="${cx}" cy="${cy}" r="${rSom}" fill="url(#som-rg)" stroke="${colors[2]}" stroke-width="2" opacity="0.85" filter="url(#shadow-sm)"/>`;

  // 라벨
  svg += `<text x="${cx}" y="${cy - rTam + 22}" text-anchor="middle" font-size="12" font-weight="bold" fill="${colors[0]}">TAM</text>`;
  svg += `<text x="${cx}" y="${cy - rSam + 20}" text-anchor="middle" font-size="11" font-weight="bold" fill="${colors[1]}">SAM</text>`;
  svg += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">SOM</text>`;
  svg += `<text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" fill="white">${escapeXml(data.som || "")}</text>`;

  // 우측 설명 (pill 배경 + 큰 값)
  const descX = width * 0.68;
  let descY = height * 0.2;
  const items = [
    { label: "TAM", value: data.tam || "", color: colors[0], desc: "전체 시장" },
    { label: "SAM", value: data.sam || "", color: colors[1], desc: "유효 시장" },
    { label: "SOM", value: data.som || "", color: colors[2], desc: "목표 시장" },
  ];
  items.forEach((item) => {
    // pill 배경
    svg += `<rect x="${descX - 8}" y="${descY - 16}" width="${width * 0.3}" height="52" fill="${hexToRgba(item.color, 0.06)}" rx="8"/>`;
    svg += `<rect x="${descX - 8}" y="${descY - 16}" width="4" height="52" fill="${item.color}" rx="2"/>`;
    svg += `<text x="${descX + 4}" y="${descY}" font-size="11" font-weight="bold" fill="${item.color}">${item.label}</text>`;
    svg += `<text x="${descX + 4}" y="${descY + 18}" font-size="14" font-weight="bold" fill="${theme.textDark}">${escapeXml(item.value)}</text>`;
    svg += `<text x="${descX + 4}" y="${descY + 32}" font-size="9" fill="${theme.textLight}">${item.desc}</text>`;
    descY += 62;
  });

  if (data.cagr) {
    svg += `<rect x="${descX - 8}" y="${descY - 10}" width="100" height="26" fill="${theme.positive}" rx="13" opacity="0.9"/>`;
    svg += `<text x="${descX + 42}" y="${descY + 7}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">CAGR ${escapeXml(data.cagr)}</text>`;
  }

  svg += "</svg>";
  return svg;
}

// ===== comparison_table: 데이터 시각화 테이블 =====

function renderComparisonTable(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    headers?: string[];
    rows?: string[][];
    dimensions?: Array<Record<string, string>>;
    competitors?: Array<{ name: string; type?: string }>;
  };

  const raw = data as Record<string, unknown>;
  let headers: string[] = (data.headers || (raw.columns as string[]) || []) as string[];
  let rows: string[][] = [];

  // 형식 1: rows가 이미 string[][] (정상 형식)
  if (data.rows && Array.isArray(data.rows) && data.rows.length > 0) {
    if (Array.isArray(data.rows[0])) {
      // rows가 string[][] 형식
      rows = data.rows as string[][];
    } else if (typeof data.rows[0] === "object" && data.rows[0] !== null) {
      // 형식 2: rows가 객체 배열 { category, values[], highlight? }
      const objRows = data.rows as unknown as Array<Record<string, unknown>>;
      rows = objRows.map((r) => {
        const category = String(r.category || r.label || r.name || "");
        const vals = Array.isArray(r.values) ? r.values.map(String) : [];
        return [category, ...vals];
      });
      // headers가 없으면 columns에서 가져오거나 기본 생성
      if (headers.length === 0) {
        const maxCols = Math.max(...rows.map((r) => r.length));
        headers = ["항목", ...Array.from({ length: maxCols - 1 }, (_, i) => `항목${i + 1}`)];
        // columns가 있으면 사용
        if (raw.columns && Array.isArray(raw.columns)) {
          headers = raw.columns as string[];
        }
      }
    }
  }

  // 형식 3: dimensions+competitors → headers+rows
  if (headers.length === 0 && rows.length === 0 && data.dimensions && data.dimensions.length > 0) {
    const dim0 = data.dimensions[0];
    const colKeys = Object.keys(dim0).filter((k) => k !== "metric" && k !== "winner" && k !== "advantage");
    headers = ["항목", ...colKeys.map((k) => k.replace(/_/g, " "))];
    rows = data.dimensions.map((d) => [d.metric || "", ...colKeys.map((k) => d[k] || "")]);
  }

  // 형식 4: categories + competitors[{name, values[]}]
  if (headers.length === 0 && rows.length === 0 && raw.categories && raw.competitors) {
    const cats = raw.categories as string[];
    const comps = raw.competitors as Array<{ name: string; values: (string | number)[] }>;
    headers = ["항목", ...comps.map((c) => c.name)];
    rows = cats.map((cat, i) => [cat, ...comps.map((c) => String(c.values?.[i] ?? ""))]);
  }

  if (headers.length === 0 || rows.length === 0) return renderFallback(chart, opts);

  const rowH = 34;
  const neededHeight = 50 + (rows.length + 1) * rowH + 20;
  const h = Math.max(height, neededHeight);
  const colW = (width - 40) / headers.length;

  let svg = svgHeader(width, h);
  svg += svgDefs();
  svg += `<rect width="${width}" height="${h}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, { ...opts, height: h });

  const tableY = 48;

  // 테이블 외곽 둥근 테두리
  svg += `<rect x="18" y="${tableY - 2}" width="${width - 36}" height="${(rows.length + 1) * rowH + 6}" fill="none" stroke="${theme.gridColor}" stroke-width="1" rx="8"/>`;

  // 헤더 행 (그라데이션)
  svg += `<defs>${linearGradientDef("tbl-hdr", theme.headerBg, "horizontal")}</defs>`;
  svg += `<rect x="19" y="${tableY - 1}" width="${width - 38}" height="${rowH}" fill="url(#tbl-hdr)" rx="7"/>`;
  headers.forEach((hdr, i) => {
    const fontWeight = i === 0 ? "bold" : "bold";
    svg += `<text x="${20 + colW * i + colW / 2}" y="${tableY + 22}" text-anchor="middle" font-size="11" font-weight="${fontWeight}" fill="${theme.headerText}">${escapeXml(truncateText(hdr, 14))}</text>`;
  });

  // 데이터 행
  rows.forEach((row, ri) => {
    const y = tableY + rowH * (ri + 1);
    const fill = ri % 2 === 0 ? "white" : hexToRgba(theme.primary, 0.03);
    svg += `<rect x="19" y="${y}" width="${width - 38}" height="${rowH}" fill="${fill}"/>`;

    const cells = Array.isArray(row) ? row : (typeof row === "object" && row !== null ? Object.values(row) : [String(row)]);
    cells.forEach((cell, ci) => {
      if (ci < headers.length) {
        const cellStr = String(cell ?? "");
        const cx = 20 + colW * ci + colW / 2;
        const cy = y + 22;

        // O/X 셀에 컬러 뱃지
        if (cellStr.trim() === "O" || cellStr.trim() === "○") {
          svg += `<circle cx="${cx}" cy="${cy - 5}" r="9" fill="${hexToRgba(theme.positive, 0.15)}"/>`;
          svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.positive}">O</text>`;
        } else if (cellStr.trim() === "X" || cellStr.trim() === "×") {
          svg += `<circle cx="${cx}" cy="${cy - 5}" r="9" fill="${hexToRgba(theme.negative, 0.1)}"/>`;
          svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="12" font-weight="bold" fill="${theme.negative}">X</text>`;
        } else {
          const fillColor = ci === 0 ? theme.textDark : theme.textDark;
          const weight = ci === 0 ? "bold" : "normal";
          svg += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="10" font-weight="${weight}" fill="${fillColor}">${escapeXml(truncateText(cellStr, 16))}</text>`;
        }
      }
    });

    // 행 구분선
    if (ri < rows.length - 1) {
      svg += `<line x1="30" y1="${y + rowH}" x2="${width - 30}" y2="${y + rowH}" stroke="${theme.gridColor}" stroke-width="0.5" opacity="0.5"/>`;
    }
  });

  svg += "</svg>";
  return svg;
}

// ===== timeline: 커넥티드 타임라인 =====

function renderTimeline(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    events?: Array<{ date: string; event: string; detail?: string }>;
    phases?: Array<{ quarter?: string; milestone?: string; kpi?: string; budget?: number; period?: string; title?: string }>;
  };

  // phases 형식을 events로 변환
  let events = data.events || [];
  if (events.length === 0 && data.phases) {
    events = data.phases.map((p) => ({
      date: p.quarter || p.period || "",
      event: p.milestone || p.title || "",
      detail: p.kpi || "",
    }));
  }

  // quarters + 숫자 배열 형식 → 타임라인 이벤트로 변환 (또는 bar로 폴백)
  if (events.length === 0) {
    const raw = data as Record<string, unknown>;
    if (raw.quarters && Array.isArray(raw.quarters)) {
      const quarters = raw.quarters as string[];
      const numKeys = Object.keys(raw).filter((k) => k !== "quarters" && k !== "unit" && Array.isArray(raw[k]) && (raw[k] as unknown[]).length > 0 && typeof (raw[k] as unknown[])[0] === "number");
      if (numKeys.length > 0) {
        // bar 차트로 렌더링하는 게 더 적합
        return renderBar({
          ...chart,
          type: "bar",
          data: {
            categories: quarters,
            series: numKeys.map((k) => ({ name: k.replace(/_/g, " "), values: raw[k] as number[] })),
            unit: raw.unit,
          },
        }, opts);
      }
    }
  }

  if (events.length === 0) return renderFallback(chart, opts);

  const lineY = height * 0.5;
  const startX = 60;
  const endX = width - 60;
  const gap = events.length > 1 ? (endX - startX) / (events.length - 1) : 0;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<defs>${linearGradientDef("tl-line", theme.primary, "horizontal")}</defs>`;
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // 그라데이션 축 라인
  svg += `<line x1="${startX}" y1="${lineY}" x2="${endX}" y2="${lineY}" stroke="url(#tl-line)" stroke-width="4" stroke-linecap="round"/>`;

  events.forEach((ev, i) => {
    const x = events.length === 1 ? (startX + endX) / 2 : startX + gap * i;
    const color = theme.chartColors[i % theme.chartColors.length];

    // 이벤트 카드 (위/아래 교대)
    if (i % 2 === 0) {
      // 카드 배경
      const cardW = Math.min(gap * 0.85, 100);
      svg += `<rect x="${x - cardW / 2}" y="${lineY - 72}" width="${cardW}" height="50" fill="white" rx="6" filter="url(#shadow-sm)" stroke="${color}" stroke-width="1"/>`;
      svg += `<rect x="${x - cardW / 2}" y="${lineY - 72}" width="${cardW}" height="4" fill="${color}" rx="2"/>`;
      svg += `<text x="${x}" y="${lineY - 50}" text-anchor="middle" font-size="10" font-weight="bold" fill="${theme.primary}">${escapeXml(truncateText(ev.date, 12))}</text>`;
      svg += `<text x="${x}" y="${lineY - 34}" text-anchor="middle" font-size="9" fill="${theme.textDark}">${escapeXml(truncateText(ev.event, 14))}</text>`;
      // 연결선
      svg += `<line x1="${x}" y1="${lineY - 22}" x2="${x}" y2="${lineY - 10}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    } else {
      const cardW = Math.min(gap * 0.85, 100);
      svg += `<rect x="${x - cardW / 2}" y="${lineY + 24}" width="${cardW}" height="50" fill="white" rx="6" filter="url(#shadow-sm)" stroke="${color}" stroke-width="1"/>`;
      svg += `<rect x="${x - cardW / 2}" y="${lineY + 70}" width="${cardW}" height="4" fill="${color}" rx="2"/>`;
      svg += `<text x="${x}" y="${lineY + 44}" text-anchor="middle" font-size="10" font-weight="bold" fill="${theme.primary}">${escapeXml(truncateText(ev.date, 12))}</text>`;
      svg += `<text x="${x}" y="${lineY + 60}" text-anchor="middle" font-size="9" fill="${theme.textDark}">${escapeXml(truncateText(ev.event, 14))}</text>`;
      svg += `<line x1="${x}" y1="${lineY + 10}" x2="${x}" y2="${lineY + 24}" stroke="${color}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    }

    // 마커 (이중 원)
    svg += `<circle cx="${x}" cy="${lineY}" r="10" fill="white" stroke="${color}" stroke-width="2.5"/>`;
    svg += `<circle cx="${x}" cy="${lineY}" r="5" fill="${color}"/>`;
    svg += `<text x="${x}" y="${lineY + 3.5}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">${i + 1}</text>`;
  });

  svg += "</svg>";
  return svg;
}

// ===== highlight_cards: 모던 KPI 카드 =====

function renderHighlightCards(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { items?: Array<{ icon?: string; label: string; value: string }>; cards?: Array<{ icon?: string; label: string; value: string }>; metrics?: Array<{ icon?: string; label: string; value: string; color?: string }> };
  const items = data.items || data.cards || data.metrics || [];
  if (items.length === 0) return renderFallback(chart, opts);

  const cardCount = Math.min(items.length, 4);
  const cardGap = 14;
  const totalGap = cardGap * (cardCount - 1);
  const cardW = (width - 40 - totalGap) / cardCount;
  const cardH = height - 56;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // SVG 심볼 (간단한 인포그래픽 아이콘)
  const symbols = ["M5,2 L8,8 L2,8 Z", "M2,5 L5,2 L8,5 L5,8 Z", "M2,5 A3,3 0 1,1 8,5 A3,3 0 1,1 2,5", "M1,8 L5,1 L9,8 Z"];

  items.slice(0, 4).forEach((item, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 44;
    const color = theme.chartColors[i % theme.chartColors.length];

    // 카드 (그림자 + accent top border)
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="white" rx="10" filter="url(#shadow)"/>`;
    // accent top bar
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="5" fill="${color}" rx="3"/>`;

    // 아이콘 (SVG 심볼 원형 배경)
    const iconCx = x + cardW / 2;
    const iconCy = y + 30;
    svg += `<circle cx="${iconCx}" cy="${iconCy}" r="14" fill="${hexToRgba(color, 0.12)}"/>`;
    svg += `<g transform="translate(${iconCx - 5}, ${iconCy - 5}) scale(1)"><path d="${symbols[i % symbols.length]}" fill="${color}" opacity="0.8"/></g>`;

    // 값 (크게)
    svg += `<text x="${x + cardW / 2}" y="${y + cardH / 2 + 14}" text-anchor="middle" font-size="22" font-weight="bold" fill="${color}">${escapeXml(truncateText(item.value, 10))}</text>`;

    // 라벨
    svg += `<text x="${x + cardW / 2}" y="${y + cardH - 12}" text-anchor="middle" font-size="10" fill="${theme.textLight}">${escapeXml(truncateText(item.label, 12))}</text>`;
  });

  svg += "</svg>";
  return svg;
}

// ===== pain_points: 경고 인포그래픽 =====

function renderPainPoints(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as { points?: Array<{ icon: string; title: string; value: string; description: string }> };
  const points = data.points || [];
  if (points.length === 0) return renderFallback(chart, opts);

  const count = Math.min(points.length, 4);
  const cardW = (width - 40 - 14 * (count - 1)) / count;
  const cardH = height - 68;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  points.slice(0, 4).forEach((p, i) => {
    const x = 20 + i * (cardW + 14);
    const y = 50;

    // 카드 (그림자 + 좌측 accent border)
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="white" rx="8" filter="url(#shadow)"/>`;
    svg += `<rect x="${x}" y="${y + 8}" width="4" height="${cardH - 16}" fill="${theme.negative}" rx="2"/>`;

    // "!" 경고 심볼
    svg += `<circle cx="${x + cardW / 2}" cy="${y + 38}" r="18" fill="${hexToRgba(theme.negative, 0.1)}"/>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 44}" text-anchor="middle" font-size="18" font-weight="bold" fill="${theme.negative}">!</text>`;

    // 제목
    svg += `<text x="${x + cardW / 2}" y="${y + 76}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(p.title, 12))}</text>`;

    // 수치 (하이라이트 배경)
    const valStr = truncateText(p.value, 12);
    const valW = valStr.length * 8 + 16;
    svg += `<rect x="${x + cardW / 2 - valW / 2}" y="${y + 88}" width="${valW}" height="24" fill="${hexToRgba(theme.negative, 0.08)}" rx="4"/>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 105}" text-anchor="middle" font-size="14" font-weight="bold" fill="${theme.negative}">${escapeXml(valStr)}</text>`;

    // 설명
    svg += `<text x="${x + cardW / 2}" y="${y + 132}" text-anchor="middle" font-size="9" fill="${theme.textLight}">${escapeXml(truncateText(p.description, 20))}</text>`;
  });

  svg += "</svg>";
  return svg;
}

// ===== tco_comparison: 비교 인포그래픽 =====

function renderTcoComparison(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    before?: { label: string; total: string; items: Array<{ name: string; value: string }> };
    after?: { label: string; total: string; items: Array<{ name: string; value: string }> };
    saving_rate?: string;
  };

  if (!data.before || !data.after) return renderFallback(chart, opts);

  const midX = width / 2;
  const barMaxW = width * 0.30;
  const barH = 26;

  const parseVal = (s: string | number) => {
    const str = String(s);
    const n = parseFloat(str.replace(/[^0-9.]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const beforeVals = data.before.items.map((i) => parseVal(i.value));
  const afterVals = data.after.items.map((i) => parseVal(i.value));
  const maxV = Math.max(...beforeVals, ...afterVals, 1);
  const count = Math.max(data.before.items.length, data.after.items.length);

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<defs>${linearGradientDef("tco-neg", theme.negative, "horizontal")}${linearGradientDef("tco-pos", theme.positive, "horizontal")}</defs>`;
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // 헤더 뱃지
  const hdrY = 52;
  svg += `<rect x="${midX - barMaxW - 10}" y="${hdrY - 14}" width="${barMaxW}" height="24" fill="${hexToRgba(theme.negative, 0.1)}" rx="12"/>`;
  svg += `<text x="${midX - barMaxW / 2 - 10}" y="${hdrY + 2}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.negative}">${escapeXml(data.before.label)}</text>`;
  svg += `<rect x="${midX + 10}" y="${hdrY - 14}" width="${barMaxW}" height="24" fill="${hexToRgba(theme.positive, 0.1)}" rx="12"/>`;
  svg += `<text x="${midX + barMaxW / 2 + 10}" y="${hdrY + 2}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.positive}">${escapeXml(data.after.label)}</text>`;

  let y = 80;
  for (let i = 0; i < count; i++) {
    const bItem = data.before.items[i];
    const aItem = data.after.items[i];
    const bVal = bItem ? parseVal(bItem.value) : 0;
    const aVal = aItem ? parseVal(aItem.value) : 0;
    const bW = Math.max((bVal / maxV) * barMaxW, 4);
    const aW = Math.max((aVal / maxV) * barMaxW, 4);
    const label = bItem?.name || aItem?.name || "";

    // 중앙 라벨 (pill)
    const lblW = label.length * 7 + 12;
    svg += `<rect x="${midX - lblW / 2}" y="${y - 2}" width="${lblW}" height="${barH + 4}" fill="${hexToRgba(theme.primary, 0.05)}" rx="4"/>`;
    svg += `<text x="${midX}" y="${y + barH / 2 + 4}" text-anchor="middle" font-size="9" font-weight="bold" fill="${theme.textLight}">${escapeXml(truncateText(label, 10))}</text>`;

    // 좌측 (before)
    svg += `<rect x="${midX - lblW / 2 - 8 - bW}" y="${y}" width="${bW}" height="${barH}" fill="${hexToRgba(theme.negative, 0.65)}" rx="5"/>`;
    svg += `<text x="${midX - lblW / 2 - 12 - bW}" y="${y + barH / 2 + 4}" text-anchor="end" font-size="9" fill="${theme.textDark}">${escapeXml(bItem?.value || "")}</text>`;

    // 우측 (after)
    svg += `<rect x="${midX + lblW / 2 + 8}" y="${y}" width="${aW}" height="${barH}" fill="${hexToRgba(theme.positive, 0.65)}" rx="5"/>`;
    svg += `<text x="${midX + lblW / 2 + 12 + aW}" y="${y + barH / 2 + 4}" font-size="9" fill="${theme.textDark}">${escapeXml(aItem?.value || "")}</text>`;

    y += barH + 10;
  }

  // 절감률 뱃지 (글로우)
  if (data.saving_rate) {
    const badgeY = height - 52;
    svg += `<rect x="${midX - 70}" y="${badgeY}" width="140" height="38" fill="${theme.positive}" rx="19" filter="url(#shadow)"/>`;
    svg += `<text x="${midX}" y="${badgeY + 24}" text-anchor="middle" font-size="14" font-weight="bold" fill="white">${escapeXml(data.saving_rate)} 절감</text>`;
  }

  svg += "</svg>";
  return svg;
}

// ===== step_roadmap: 프로그레스 인포그래픽 =====

function renderStepRoadmap(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    steps?: Array<{ step: number; title: string; period?: string; target?: string; goal?: string }>;
    milestones?: Array<{ name?: string; title?: string; period?: string; status?: string; kpis?: string[] }>;
  };

  let steps = data.steps || [];
  if (steps.length === 0 && data.milestones) {
    steps = data.milestones.map((m, i) => ({
      step: i + 1,
      title: m.name || m.title || "",
      period: m.period || "",
      target: m.kpis ? m.kpis[0] : "",
    }));
  }
  if (steps.length === 0) return renderFallback(chart, opts);

  const count = steps.length;
  const stepW = Math.min((width - 40 - (count - 1) * 28) / count, 140);
  const stepH = height - 80;
  const totalW = count * stepW + (count - 1) * 28;
  const startX = (width - totalW) / 2;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  // 각 단계별 그라데이션
  steps.forEach((_, i) => {
    const color = theme.chartColors[i % theme.chartColors.length];
    svg += `<defs>${linearGradientDef(`step-g${i}`, color)}</defs>`;
  });
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  steps.forEach((s, i) => {
    const x = startX + i * (stepW + 28);
    const y = 50;
    const color = theme.chartColors[i % theme.chartColors.length];
    // 진행 상태에 따라 투명도 조절 (앞일수록 진함)
    const opacity = 1 - (i * 0.08);

    // 카드 (그라데이션 배경 + 그림자)
    svg += `<rect x="${x}" y="${y}" width="${stepW}" height="${stepH}" fill="${hexToRgba(color, 0.06)}" rx="10" filter="url(#shadow)" stroke="${color}" stroke-width="1.5" opacity="${opacity}"/>`;

    // 단계 번호 원 (그라데이션)
    svg += `<circle cx="${x + stepW / 2}" cy="${y + 24}" r="16" fill="url(#step-g${i})" filter="url(#shadow-sm)"/>`;
    svg += `<text x="${x + stepW / 2}" y="${y + 29}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${s.step}</text>`;

    // 제목
    svg += `<text x="${x + stepW / 2}" y="${y + 58}" text-anchor="middle" font-size="11" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(s.title, 10))}</text>`;

    // 기간
    if (s.period) {
      svg += `<text x="${x + stepW / 2}" y="${y + 76}" text-anchor="middle" font-size="9" fill="${color}">${escapeXml(truncateText(s.period, 12))}</text>`;
    }

    // 목표
    if (s.goal) {
      svg += `<text x="${x + stepW / 2}" y="${y + stepH - 14}" text-anchor="middle" font-size="8" fill="${theme.textLight}">${escapeXml(truncateText(s.goal, 14))}</text>`;
    }

    // 쉐브론 화살표 (마지막 빼고)
    if (i < count - 1) {
      const arrowX = x + stepW + 4;
      const arrowY = y + stepH / 2;
      svg += `<path d="M ${arrowX} ${arrowY - 10} L ${arrowX + 18} ${arrowY} L ${arrowX} ${arrowY + 10}" fill="none" stroke="${theme.primary}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity="0.5"/>`;
    }
  });

  svg += "</svg>";
  return svg;
}

// ===== revenue_model: 프라이싱 카드 =====

function renderRevenueModel(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    tracks?: Array<{ name: string; subtitle: string; price: string; features: string[] }>;
    series?: Array<{ name: string; values: number[]; unit?: string }>;
    categories?: string[];
  };

  // AI가 series+categories 형식으로 생성한 경우 → bar 차트로 렌더링
  if (!data.tracks && data.series && data.categories) {
    return renderBar({ ...chart, type: "bar" }, opts);
  }

  const tracks = data.tracks || [];
  if (tracks.length === 0) return renderFallback(chart, opts);

  const count = Math.min(tracks.length, 3);
  const cardGap = 16;
  const cardW = (width - 40 - cardGap * (count - 1)) / count;
  const cardH = height - 68;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  tracks.slice(0, 3).forEach((_, i) => {
    const color = theme.chartColors[i % theme.chartColors.length];
    svg += `<defs>${linearGradientDef(`rv-g${i}`, color)}</defs>`;
  });
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  tracks.slice(0, 3).forEach((t, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 48;
    const color = theme.chartColors[i % theme.chartColors.length];
    const isMiddle = count === 3 && i === 1;

    // 카드 (그림자)
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="white" rx="10" filter="url(#shadow)" stroke="${isMiddle ? color : theme.gridColor}" stroke-width="${isMiddle ? 2 : 1}"/>`;

    // 헤더 (그라데이션)
    svg += `<rect x="${x + 1}" y="${y + 1}" width="${cardW - 2}" height="48" fill="url(#rv-g${i})" rx="9"/>`;

    // 추천 리본 (중간 카드)
    if (isMiddle) {
      svg += `<rect x="${x + cardW - 44}" y="${y - 4}" width="40" height="18" fill="${theme.positive}" rx="4"/>`;
      svg += `<text x="${x + cardW - 24}" y="${y + 9}" text-anchor="middle" font-size="8" font-weight="bold" fill="white">추천</text>`;
    }

    // 이름
    svg += `<text x="${x + cardW / 2}" y="${y + 24}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${escapeXml(truncateText(t.name, 14))}</text>`;
    svg += `<text x="${x + cardW / 2}" y="${y + 40}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.85)">${escapeXml(truncateText(t.subtitle, 16))}</text>`;

    // 가격
    svg += `<text x="${x + cardW / 2}" y="${y + 78}" text-anchor="middle" font-size="18" font-weight="bold" fill="${color}">${escapeXml(t.price)}</text>`;

    // 기능 (체크마크 원형)
    t.features.slice(0, 5).forEach((f, fi) => {
      const fy = y + 98 + fi * 22;
      svg += `<circle cx="${x + 18}" cy="${fy - 3}" r="5" fill="${hexToRgba(color, 0.15)}"/>`;
      svg += `<text x="${x + 18}" y="${fy}" text-anchor="middle" font-size="8" fill="${color}">&#x2713;</text>`;
      svg += `<text x="${x + 30}" y="${fy}" font-size="10" fill="${theme.textDark}">${escapeXml(truncateText(f, 16))}</text>`;
    });
  });

  svg += "</svg>";
  return svg;
}

// ===== org_chart: 트리 조직도 =====

function renderOrgChart(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    members?: Array<{ role: string; name: string; title: string; detail?: string }>;
    structure?: { ceo?: string; departments?: Array<{ name: string; roles?: string[] }> };
  };
  const members = data.members || [];

  // structure 형식을 members로 변환
  if (members.length === 0 && data.structure) {
    const s = data.structure;
    if (s.ceo) {
      members.push({ role: "CEO", name: s.ceo, title: "대표이사", detail: "" });
    }
    if (s.departments) {
      for (const dept of s.departments) {
        members.push({
          role: "팀",
          name: dept.name.replace(/\s*\(\d+명\)\s*/, ""),
          title: `${dept.roles?.length || 0}명`,
          detail: dept.roles?.join(", ") || "",
        });
      }
    }
  }

  if (members.length === 0) return renderFallback(chart, opts);

  const boxW = 120;
  const boxH = 56;
  const topY = 56;
  const bottomY = height * 0.55;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  svg += `<defs>${radialGradientDef("org-top", theme.primary)}</defs>`;
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // 대표
  const topX = width / 2 - boxW / 2;
  svg += `<rect x="${topX}" y="${topY}" width="${boxW}" height="${boxH}" fill="url(#org-top)" rx="10" filter="url(#shadow)"/>`;
  svg += `<text x="${width / 2}" y="${topY + 22}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">${escapeXml(truncateText(members[0].name, 8))}</text>`;
  svg += `<text x="${width / 2}" y="${topY + 40}" text-anchor="middle" font-size="9" fill="rgba(255,255,255,0.85)">${escapeXml(truncateText(members[0].title, 12))}</text>`;

  // 하위
  const subs = members.slice(1);
  if (subs.length > 0) {
    const subCount = Math.min(subs.length, 5);
    const totalSubW = subCount * boxW + (subCount - 1) * 20;
    const subStartX = (width - totalSubW) / 2;

    svg += `<line x1="${width / 2}" y1="${topY + boxH}" x2="${width / 2}" y2="${(topY + boxH + bottomY) / 2}" stroke="${theme.gridColor}" stroke-width="2"/>`;
    svg += `<line x1="${subStartX + boxW / 2}" y1="${(topY + boxH + bottomY) / 2}" x2="${subStartX + (subCount - 1) * (boxW + 20) + boxW / 2}" y2="${(topY + boxH + bottomY) / 2}" stroke="${theme.gridColor}" stroke-width="2"/>`;

    subs.slice(0, 5).forEach((m, i) => {
      const x = subStartX + i * (boxW + 20);
      const color = theme.chartColors[(i + 1) % theme.chartColors.length];

      svg += `<line x1="${x + boxW / 2}" y1="${(topY + boxH + bottomY) / 2}" x2="${x + boxW / 2}" y2="${bottomY}" stroke="${theme.gridColor}" stroke-width="2"/>`;
      svg += `<rect x="${x}" y="${bottomY}" width="${boxW}" height="${boxH}" fill="white" rx="10" filter="url(#shadow)" stroke="${color}" stroke-width="1.5"/>`;
      svg += `<rect x="${x}" y="${bottomY}" width="${boxW}" height="5" fill="${color}" rx="3"/>`;
      svg += `<text x="${x + boxW / 2}" y="${bottomY + 26}" text-anchor="middle" font-size="10" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(m.name, 8))}</text>`;
      svg += `<text x="${x + boxW / 2}" y="${bottomY + 42}" text-anchor="middle" font-size="9" fill="${theme.textLight}">${escapeXml(truncateText(m.title, 12))}</text>`;
    });
  }

  svg += "</svg>";
  return svg;
}

// ===== ecosystem_map: 네트워크 시각화 =====

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
  svg += svgDefs();
  svg += `<defs>${radialGradientDef("eco-hub", theme.primary)}</defs>`;
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  // 곡선 연결선 (quadratic bezier)
  const count = Math.min(partners.length, 8);
  partners.slice(0, 8).forEach((_, i) => {
    const angle = (360 / count) * i - 90;
    const pos = polarToCartesian(cx, cy, orbitR, angle);
    // 곡선 제어점
    const ctrlAngle = angle + 15;
    const ctrl = polarToCartesian(cx, cy, orbitR * 0.55, ctrlAngle);
    svg += `<path d="M ${cx} ${cy} Q ${ctrl.x} ${ctrl.y} ${pos.x} ${pos.y}" fill="none" stroke="${theme.gridColor}" stroke-width="1.5" stroke-dasharray="5,3"/>`;
  });

  // 허브 (그라데이션 + 그림자)
  svg += `<circle cx="${cx}" cy="${cy}" r="${hubR}" fill="url(#eco-hub)" filter="url(#shadow)"/>`;
  svg += `<text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="white">${escapeXml(truncateText(center, 8))}</text>`;

  // 파트너 노드
  partners.slice(0, 8).forEach((p, i) => {
    const angle = (360 / count) * i - 90;
    const pos = polarToCartesian(cx, cy, orbitR, angle);
    const color = theme.chartColors[i % theme.chartColors.length];

    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeR}" fill="white" stroke="${color}" stroke-width="2" filter="url(#shadow-sm)"/>`;
    svg += `<circle cx="${pos.x}" cy="${pos.y}" r="${nodeR}" fill="${hexToRgba(color, 0.08)}"/>`;
    svg += `<text x="${pos.x}" y="${pos.y - 2}" text-anchor="middle" font-size="9" font-weight="bold" fill="${theme.textDark}">${escapeXml(truncateText(p.name, 8))}</text>`;
    svg += `<text x="${pos.x}" y="${pos.y + 12}" text-anchor="middle" font-size="7" fill="${theme.textLight}">${escapeXml(truncateText(p.role, 8))}</text>`;
  });

  svg += "</svg>";
  return svg;
}

// ===== esg_cards: 지속가능경영 =====

function renderEsgCards(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  const data = chart.data as {
    environment?: { title?: string; items: string[] };
    social?: { title?: string; items: string[] };
    governance?: { title?: string; items: string[] };
  };

  const columns = [
    { key: "E", title: data.environment?.title || "Environment", items: data.environment?.items || [], color: "#22C55E", icon: "M5,1 C3,1 1,3 1,5.5 C1,8 5,10 5,10 C5,10 9,8 9,5.5 C9,3 7,1 5,1" },
    { key: "S", title: data.social?.title || "Social", items: data.social?.items || [], color: "#3B82F6", icon: "M5,2 A2,2 0 1,1 5,6 A2,2 0 1,1 5,2 M1,10 C1,8 3,7 5,7 C7,7 9,8 9,10" },
    { key: "G", title: data.governance?.title || "Governance", items: data.governance?.items || [], color: "#6B7280", icon: "M2,9 L5,2 L8,9 Z M4,7 L6,7" },
  ];

  const cardGap = 14;
  const cardW = (width - 40 - cardGap * 2) / 3;
  const cardH = height - 68;

  let svg = svgHeader(width, height);
  svg += svgDefs();
  columns.forEach((col, i) => {
    svg += `<defs>${linearGradientDef(`esg-g${i}`, col.color)}</defs>`;
  });
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);

  columns.forEach((col, i) => {
    const x = 20 + i * (cardW + cardGap);
    const y = 48;

    // 카드 (그림자)
    svg += `<rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" fill="white" rx="10" filter="url(#shadow)"/>`;

    // 헤더 (그라데이션)
    svg += `<rect x="${x + 1}" y="${y + 1}" width="${cardW - 2}" height="44" fill="url(#esg-g${i})" rx="9"/>`;

    // 아이콘 심볼
    svg += `<g transform="translate(${x + 12}, ${y + 14}) scale(1.4)"><path d="${col.icon}" fill="white" opacity="0.9" fill-rule="evenodd"/></g>`;

    // 제목
    svg += `<text x="${x + cardW / 2}" y="${y + 30}" text-anchor="middle" font-size="12" font-weight="bold" fill="white">${escapeXml(truncateText(col.title, 14))}</text>`;

    // 항목 (체크마크)
    col.items.slice(0, 6).forEach((item, ii) => {
      const iy = y + 62 + ii * 22;
      svg += `<circle cx="${x + 18}" cy="${iy - 2}" r="4" fill="${hexToRgba(col.color, 0.15)}"/>`;
      svg += `<text x="${x + 18}" y="${iy + 1}" text-anchor="middle" font-size="7" fill="${col.color}">&#x2713;</text>`;
      svg += `<text x="${x + 28}" y="${iy + 1}" font-size="10" fill="${theme.textDark}">${escapeXml(truncateText(item, 16))}</text>`;
    });
  });

  svg += "</svg>";
  return svg;
}

// ===== 폴백 =====

function renderFallback(chart: ChartDataItem, opts: SvgRenderOptions): string {
  const { width, height, theme } = opts;
  let svg = svgHeader(width, height);
  svg += `<rect width="${width}" height="${height}" fill="white" rx="12"/>`;
  svg += renderTitle(chart.title, opts);
  svg += `<text x="${width / 2}" y="${height / 2 + 4}" text-anchor="middle" font-size="13" fill="${theme.textLight}">[${escapeXml(chart.type)}] 데이터 표시 불가</text>`;
  svg += "</svg>";
  return svg;
}
