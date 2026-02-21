/**
 * 차트 HTML 렌더러 — Playwright로 고품질 차트 이미지 생성
 *
 * HTML/CSS로 차트를 디자인하고 Playwright로 캡처하여 PPT에 삽입할 PNG 생성.
 * pptxgenjs 네이티브 차트 대비 훨씬 높은 디자인 퀄리티.
 */

import { chromium, type Browser } from "playwright-core";

// ─── 타입 정의 ─────────────────────────────────
interface ChartColors {
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  textDark: string;
  textLight: string;
  chartColors: string[];
  positive: string;
}

interface BarChartData {
  type: "bar";
  title: string;
  data: { labels: string[]; values: number[]; unit?: string };
}

interface PieChartData {
  type: "pie";
  title: string;
  data: { labels: string[]; values: number[] };
}

interface LineChartData {
  type: "line";
  title: string;
  data: { labels: string[]; values: number[]; unit?: string };
}

interface TamSamSomData {
  type: "tam_sam_som";
  title: string;
  data: { tam: string; sam: string; som: string; tam_desc?: string; sam_desc?: string; som_desc?: string };
}

interface ComparisonTableData {
  type: "comparison_table";
  title: string;
  data: { headers: string[]; rows: string[][] };
}

interface TimelineData {
  type: "timeline";
  title: string;
  data: { events: Array<{ date: string; title: string; desc?: string }> };
}

interface RevenueModelData {
  type: "revenue_model";
  title: string;
  data: { streams: Array<{ name: string; ratio: string; desc?: string }> };
}

interface StatsData {
  stats: Array<{ icon?: string; value: string; label: string }>;
}

type ChartData = BarChartData | PieChartData | LineChartData | TamSamSomData | ComparisonTableData | TimelineData | RevenueModelData;

// ─── 싱글턴 브라우저 관리 ─────────────────────
let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.isConnected()) {
    browserInstance = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserInstance;
}

export async function closeBrowser(): Promise<void> {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}

// ─── 아이콘 매핑 ─────────────────────────────────
const ICON_SVG: Record<string, string> = {
  chart: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>`,
  users: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  target: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
  money: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`,
  rocket: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
  bulb: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/></svg>`,
  building: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M8 10h.01M16 10h.01M12 14h.01M8 14h.01M16 14h.01"/></svg>`,
  shield: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
  growth: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  handshake: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 17a1 1 0 0 1-1 1H6l-4-4 6.75-6.77a1 1 0 0 1 1.42 0L14 11"/><path d="M13 7a1 1 0 0 1 1-1h4l4 4-6.75 6.77a1 1 0 0 1-1.42 0L10 13"/></svg>`,
  patent: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
  brain: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5L12 14l-3.5-3.5C7.5 9.5 7 8.5 7 7a5 5 0 0 1 5-5z"/><path d="M12 14v8"/></svg>`,
  won: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><text x="5" y="18" font-size="16" font-weight="bold" fill="currentColor" stroke="none">₩</text></svg>`,
  database: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  mobile: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
};

function getIconSvg(icon: string): string {
  return ICON_SVG[icon] || ICON_SVG.chart;
}

// ─── 공통 CSS ─────────────────────────────────
function baseCSS(colors: ChartColors): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Pretendard', 'Segoe UI', sans-serif;
      background: transparent;
      color: #${colors.textDark};
      -webkit-font-smoothing: antialiased;
    }
    .container { padding: 24px; }
  `;
}

// ─── 차트별 HTML 생성 ─────────────────────────
function renderBarChart(chart: BarChartData, colors: ChartColors): string {
  const { labels, values, unit } = chart.data;
  const max = Math.max(...values);
  const bars = labels.map((label, i) => {
    const pct = max > 0 ? (values[i] / max) * 100 : 0;
    const colorIdx = i % colors.chartColors.length;
    return `
      <div class="bar-group">
        <div class="bar-label">${label}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${pct}%; background:linear-gradient(90deg, #${colors.chartColors[colorIdx]}, #${colors.chartColors[(colorIdx + 1) % colors.chartColors.length]});">
            <span class="bar-value">${values[i].toLocaleString()}${unit ? ` ${unit}` : ''}</span>
          </div>
        </div>
      </div>`;
  }).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 16px; }
      .bar-group { display: flex; align-items: center; margin-bottom: 8px; }
      .bar-label { width: 60px; font-size: 11px; color: #${colors.textLight}; text-align: right; padding-right: 10px; flex-shrink: 0; }
      .bar-track { flex: 1; height: 28px; background: #f1f5f9; border-radius: 6px; overflow: hidden; position: relative; }
      .bar-fill { height: 100%; border-radius: 6px; display: flex; align-items: center; justify-content: flex-end; padding-right: 8px; min-width: 40px; transition: width 0.5s ease; }
      .bar-value { font-size: 10px; font-weight: 600; color: white; white-space: nowrap; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      ${bars}
    </div>`;
}

function renderPieChart(chart: PieChartData, colors: ChartColors): string {
  const { labels, values } = chart.data;
  const total = values.reduce((a, b) => a + b, 0);
  let cumPct = 0;
  const segments = values.map((v, i) => {
    const pct = total > 0 ? (v / total) * 100 : 0;
    const start = cumPct;
    cumPct += pct;
    return { label: labels[i], value: v, pct, start, color: colors.chartColors[i % colors.chartColors.length] };
  });

  // CSS conic-gradient
  const gradientStops = segments.map(s => `#${s.color} ${s.start}% ${s.start + s.pct}%`).join(', ');

  const legend = segments.map(s => `
    <div class="legend-item">
      <div class="legend-dot" style="background:#${s.color}"></div>
      <div class="legend-text">
        <span class="legend-label">${s.label}</span>
        <span class="legend-value">${s.pct.toFixed(0)}%</span>
      </div>
    </div>`).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .pie-wrap { display: flex; align-items: center; gap: 32px; }
      .pie-circle { width: 180px; height: 180px; border-radius: 50%; background: conic-gradient(${gradientStops}); position: relative; flex-shrink: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .pie-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 80px; height: 80px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #${colors.primary}; box-shadow: inset 0 2px 8px rgba(0,0,0,0.05); }
      .legend { display: flex; flex-direction: column; gap: 8px; }
      .legend-item { display: flex; align-items: center; gap: 8px; }
      .legend-dot { width: 12px; height: 12px; border-radius: 3px; flex-shrink: 0; }
      .legend-text { display: flex; gap: 8px; align-items: baseline; }
      .legend-label { font-size: 12px; color: #${colors.textDark}; }
      .legend-value { font-size: 12px; font-weight: 700; color: #${colors.primary}; }
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 16px; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      <div class="pie-wrap">
        <div class="pie-circle"><div class="pie-center">TOTAL<br/>${total.toLocaleString()}</div></div>
        <div class="legend">${legend}</div>
      </div>
    </div>`;
}

function renderTamSamSom(chart: TamSamSomData, colors: ChartColors): string {
  const { tam, sam, som, tam_desc, sam_desc, som_desc } = chart.data;
  return `
    <style>
      ${baseCSS(colors)}
      .tsm-wrap { display: flex; align-items: center; gap: 40px; padding: 16px; }
      .circles { position: relative; width: 260px; height: 260px; flex-shrink: 0; }
      .circle { border-radius: 50%; position: absolute; display: flex; align-items: center; justify-content: center; flex-direction: column; }
      .circle-tam { width: 260px; height: 260px; top: 0; left: 0; background: radial-gradient(circle at 30% 30%, #${colors.chartColors[0]}40, #${colors.chartColors[0]}20); border: 2px solid #${colors.chartColors[0]}60; }
      .circle-sam { width: 180px; height: 180px; top: 40px; left: 40px; background: radial-gradient(circle at 30% 30%, #${colors.chartColors[1]}60, #${colors.chartColors[1]}30); border: 2px solid #${colors.chartColors[1]}80; }
      .circle-som { width: 100px; height: 100px; top: 80px; left: 80px; background: radial-gradient(circle at 30% 30%, #${colors.accent}90, #${colors.accent}70); border: 2px solid #${colors.accent}; }
      .circle-label { font-size: 10px; font-weight: 800; letter-spacing: 1px; color: #${colors.textDark}; opacity: 0.6; }
      .circle-value { font-size: 13px; font-weight: 700; color: #${colors.textDark}; }
      .circle-som .circle-label { color: white; opacity: 1; }
      .circle-som .circle-value { color: white; font-size: 11px; }
      .details { display: flex; flex-direction: column; gap: 16px; }
      .detail-item { display: flex; align-items: flex-start; gap: 12px; }
      .detail-badge { padding: 4px 10px; border-radius: 4px; font-size: 11px; font-weight: 700; color: white; flex-shrink: 0; }
      .detail-info {}
      .detail-value { font-size: 18px; font-weight: 800; color: #${colors.textDark}; }
      .detail-desc { font-size: 11px; color: #${colors.textLight}; margin-top: 2px; }
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 12px; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      <div class="tsm-wrap">
        <div class="circles">
          <div class="circle circle-tam"><div class="circle-label">TAM</div><div class="circle-value">${tam}</div></div>
          <div class="circle circle-sam"><div class="circle-label">SAM</div><div class="circle-value">${sam}</div></div>
          <div class="circle circle-som"><div class="circle-label">SOM</div><div class="circle-value">${som}</div></div>
        </div>
        <div class="details">
          <div class="detail-item">
            <div class="detail-badge" style="background:#${colors.chartColors[0]}">TAM</div>
            <div class="detail-info"><div class="detail-value">${tam}</div><div class="detail-desc">${tam_desc || '전체 시장'}</div></div>
          </div>
          <div class="detail-item">
            <div class="detail-badge" style="background:#${colors.chartColors[1]}">SAM</div>
            <div class="detail-info"><div class="detail-value">${sam}</div><div class="detail-desc">${sam_desc || '유효 시장'}</div></div>
          </div>
          <div class="detail-item">
            <div class="detail-badge" style="background:#${colors.accent}">SOM</div>
            <div class="detail-info"><div class="detail-value">${som}</div><div class="detail-desc">${som_desc || '목표 시장'}</div></div>
          </div>
        </div>
      </div>
    </div>`;
}

function renderComparisonTable(chart: ComparisonTableData, colors: ChartColors): string {
  const { headers, rows } = chart.data;
  const headerCells = headers.map((h, i) => `<th${i === 1 ? ' class="highlight"' : ''}>${h}</th>`).join('');
  const bodyRows = rows.map(row => {
    const cells = row.map((cell, i) => {
      const isHighlight = i === 1 || cell.includes('★');
      const cleaned = cell.replace('★', '').trim();
      const hasStar = cell.includes('★');
      return `<td class="${isHighlight ? 'highlight' : ''}">${hasStar ? '<span class="star">★</span> ' : ''}${cleaned}</td>`;
    }).join('');
    return `<tr>${cells}</tr>`;
  }).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 12px; }
      table { width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); }
      th { background: #${colors.primary}; color: white; padding: 10px 14px; font-size: 11px; font-weight: 600; text-align: center; }
      th.highlight { background: #${colors.accent}; }
      td { padding: 9px 14px; font-size: 11px; text-align: center; border-bottom: 1px solid #f1f5f9; color: #${colors.textDark}; }
      td.highlight { background: #${colors.accent}10; font-weight: 600; color: #${colors.accent}; }
      tr:last-child td { border-bottom: none; }
      tr:nth-child(even) td { background: #f8fafc; }
      tr:nth-child(even) td.highlight { background: #${colors.accent}08; }
      .star { color: #${colors.accent}; font-size: 12px; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      <table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>
    </div>`;
}

function renderTimeline(chart: TimelineData, colors: ChartColors): string {
  const { events } = chart.data;
  const items = events.map((ev, i) => `
    <div class="tl-item">
      <div class="tl-dot" style="background:#${colors.chartColors[i % colors.chartColors.length]}"></div>
      <div class="tl-content">
        <div class="tl-date" style="color:#${colors.chartColors[i % colors.chartColors.length]}">${ev.date}</div>
        <div class="tl-title">${ev.title}</div>
        ${ev.desc ? `<div class="tl-desc">${ev.desc}</div>` : ''}
      </div>
    </div>`).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 16px; }
      .timeline { position: relative; padding-left: 28px; }
      .timeline::before { content: ''; position: absolute; left: 8px; top: 8px; bottom: 8px; width: 2px; background: linear-gradient(180deg, #${colors.accent}, #${colors.chartColors[2] || colors.secondary}); border-radius: 1px; }
      .tl-item { position: relative; margin-bottom: 14px; }
      .tl-dot { width: 14px; height: 14px; border-radius: 50%; position: absolute; left: -24px; top: 4px; border: 3px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.15); }
      .tl-content { padding: 8px 14px; background: #f8fafc; border-radius: 8px; border-left: 3px solid #${colors.accent}20; }
      .tl-date { font-size: 10px; font-weight: 700; margin-bottom: 2px; }
      .tl-title { font-size: 12px; font-weight: 600; color: #${colors.textDark}; }
      .tl-desc { font-size: 10px; color: #${colors.textLight}; margin-top: 2px; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      <div class="timeline">${items}</div>
    </div>`;
}

function renderRevenueModel(chart: RevenueModelData, colors: ChartColors): string {
  const { streams } = chart.data;
  const maxRatio = Math.max(...streams.map(s => parseFloat(s.ratio)));

  const items = streams.map((s, i) => {
    const pct = parseFloat(s.ratio);
    const width = maxRatio > 0 ? (pct / maxRatio) * 100 : 0;
    const color = colors.chartColors[i % colors.chartColors.length];
    return `
      <div class="rev-item">
        <div class="rev-header">
          <span class="rev-name">${s.name}</span>
          <span class="rev-ratio" style="color:#${color}">${s.ratio}</span>
        </div>
        <div class="rev-bar-track">
          <div class="rev-bar-fill" style="width:${width}%; background: linear-gradient(90deg, #${color}, #${color}cc);"></div>
        </div>
        ${s.desc ? `<div class="rev-desc">${s.desc}</div>` : ''}
      </div>`;
  }).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .chart-title { font-size: 14px; font-weight: 700; color: #${colors.textDark}; margin-bottom: 16px; }
      .rev-item { margin-bottom: 14px; }
      .rev-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
      .rev-name { font-size: 12px; font-weight: 600; color: #${colors.textDark}; }
      .rev-ratio { font-size: 14px; font-weight: 800; }
      .rev-bar-track { height: 8px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
      .rev-bar-fill { height: 100%; border-radius: 4px; }
      .rev-desc { font-size: 10px; color: #${colors.textLight}; margin-top: 3px; }
    </style>
    <div class="container">
      <div class="chart-title">${chart.title}</div>
      ${items}
    </div>`;
}

// ─── Stats 카드 렌더러 ─────────────────────────
function renderStatsCards(data: StatsData, colors: ChartColors): string {
  const cards = data.stats.slice(0, 4).map((s, i) => {
    const color = colors.chartColors[i % colors.chartColors.length];
    const iconSvg = getIconSvg(s.icon || 'chart');
    return `
      <div class="stat-card">
        <div class="stat-accent" style="background:#${color}"></div>
        <div class="stat-icon" style="color:#${color}">${iconSvg}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-label">${s.label}</div>
      </div>`;
  }).join('');

  return `
    <style>
      ${baseCSS(colors)}
      .stats-row { display: flex; gap: 12px; }
      .stat-card { flex: 1; background: white; border-radius: 10px; padding: 14px 12px; position: relative; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.06); text-align: center; }
      .stat-accent { position: absolute; top: 0; left: 0; width: 100%; height: 3px; }
      .stat-icon { width: 28px; height: 28px; margin: 0 auto 6px; }
      .stat-icon svg { width: 100%; height: 100%; }
      .stat-value { font-size: 20px; font-weight: 800; color: #${colors.primary}; line-height: 1.2; }
      .stat-label { font-size: 10px; color: #${colors.textLight}; margin-top: 3px; }
    </style>
    <div class="container">
      <div class="stats-row">${cards}</div>
    </div>`;
}

// ─── 메인 렌더링 함수 ─────────────────────────
export async function renderChartImage(
  chart: ChartData,
  colors: ChartColors,
  width = 560,
  height = 320
): Promise<Buffer> {
  let html = '';
  switch (chart.type) {
    case 'bar': html = renderBarChart(chart, colors); break;
    case 'pie': html = renderPieChart(chart, colors); break;
    case 'line': html = renderBarChart({ ...chart, type: 'bar' } as BarChartData, colors); break; // line도 bar 스타일 사용
    case 'tam_sam_som': html = renderTamSamSom(chart, colors); height = 300; width = 600; break;
    case 'comparison_table': html = renderComparisonTable(chart, colors); width = 700; break;
    case 'timeline': html = renderTimeline(chart, colors); width = 400; break;
    case 'revenue_model': html = renderRevenueModel(chart, colors); break;
    default: return Buffer.from('');
  }

  return await captureHTML(html, width, height);
}

export async function renderStatsImage(
  stats: Array<{ icon?: string; value: string; label: string }>,
  colors: ChartColors,
  width = 700,
  height = 100
): Promise<Buffer> {
  const html = renderStatsCards({ stats }, colors);
  return await captureHTML(html, width, height);
}

async function captureHTML(html: string, width: number, height: number): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setViewportSize({ width, height: height * 2 });
    await page.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`, {
      waitUntil: 'networkidle',
    });

    // 실제 콘텐츠 높이에 맞춰 캡처
    const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
    const screenshot = await page.screenshot({
      type: 'png',
      clip: { x: 0, y: 0, width, height: Math.min(bodyHeight, height * 2) },
      omitBackground: true, // 투명 배경
    });

    return Buffer.from(screenshot);
  } finally {
    await page.close();
  }
}
