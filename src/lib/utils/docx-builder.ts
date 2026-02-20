/**
 * 마크다운 → DOCX 변환 유틸리티 (v2 — 인포그래픽 강화)
 * docx 라이브러리를 사용하여 사업계획서를 DOCX 파일로 생성
 * Stage 1.5에서 추출한 chart_data, kpi_data를 활용하여 시각적 요소 삽입
 */

import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  TableRow,
  TableCell,
  Table,
  WidthType,
  BorderStyle,
  PageBreak,
  Footer,
  Header,
  convertMillimetersToTwip,
  Packer,
  ShadingType,
  VerticalAlign,
  ImageRun,
} from "docx";
import { chartsToImages, ChartImageResult } from "@/lib/charts/chart-to-image";
import { getThemeForTemplate } from "@/lib/charts/themes";

// ===== 색상 팔레트 (테마 기반 + 폴백) =====
function getColors(templateType?: string) {
  const theme = getThemeForTemplate(templateType);
  const stripHash = (c: string) => c.replace("#", "");
  return {
    primary: stripHash(theme.primary),
    secondary: stripHash(theme.chartColors[1] || theme.accent),
    accent: stripHash(theme.accent),
    background: stripHash(theme.background),
    textDark: stripHash(theme.textDark),
    positive: stripHash(theme.positive),
    negative: stripHash(theme.negative),
    neutral: stripHash(theme.textLight),
    headerBg: stripHash(theme.headerBg),
    headerText: stripHash(theme.headerText),
    highlightBg: stripHash(theme.background),
    highlightBorder: stripHash(theme.chartColors[1] || theme.accent),
  };
}

// 기본 COLORS (하위 호환)
const COLORS = getColors();

// ===== chart_data 인터페이스 =====
interface ChartDataItem {
  type: "bar" | "pie" | "line" | "tam_sam_som" | "comparison_table" | "timeline" | "highlight_cards" | "pain_points" | "tco_comparison" | "revenue_model" | "org_chart" | "ecosystem_map" | "esg_cards" | "step_roadmap";
  title: string;
  data: Record<string, unknown>;
}

interface KpiData {
  revenue?: string;
  revenue_growth?: string;
  employees?: string;
  tam?: string;
  sam?: string;
  som?: string;
  key_competitors?: string[];
  patents?: string;
  milestones?: Array<{ date: string; event: string }>;
  [key: string]: unknown;
}

interface DocxOptions {
  title: string;
  companyName: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
  chartData?: Record<string, ChartDataItem[]>;  // 섹션별 차트 데이터
  kpiData?: KpiData;                              // 전체 KPI 데이터
  templateType?: string;                          // 양식 유형
}

/**
 * 마크다운 텍스트를 docx Paragraph 배열로 변환
 */
function parseMarkdownToParagraphs(markdown: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const lines = markdown.split("\n");
  let inTable = false;
  let tableRows: string[][] = [];
  let tableHeaders: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === "") {
      if (inTable && tableRows.length > 0) {
        paragraphs.push(...buildStyledTable(tableHeaders, tableRows));
        inTable = false;
        tableRows = [];
        tableHeaders = [];
      }
      continue;
    }

    // 테이블 행 감지
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim());

      // 구분선 건너뛰기
      if (cells.every((c) => /^[-:]+$/.test(c))) {
        continue;
      }

      if (!inTable) {
        inTable = true;
        tableHeaders = cells;
      } else {
        tableRows.push(cells);
      }
      continue;
    }

    // 테이블 종료
    if (inTable && tableRows.length > 0) {
      paragraphs.push(...buildStyledTable(tableHeaders, tableRows));
      inTable = false;
      tableRows = [];
      tableHeaders = [];
    }

    // ### 소제목 (H3)
    if (line.startsWith("### ")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace("### ", ""),
              bold: true,
              size: 24,
              font: "맑은 고딕",
              color: COLORS.primary,
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // ## 중제목 (H2)
    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace("## ", ""),
              bold: true,
              size: 26,
              font: "맑은 고딕",
              color: COLORS.primary,
            }),
          ],
          spacing: { before: 300, after: 120 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.secondary },
          },
        })
      );
      continue;
    }

    // --- 구분선
    if (line.trim() === "---" || line.trim() === "***") {
      paragraphs.push(
        new Paragraph({
          children: [],
          spacing: { before: 120, after: 120 },
          border: {
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
        })
      );
      continue;
    }

    // 불릿 리스트
    if (/^[\s]*[-*•]\s/.test(line)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      const text = line.replace(/^[\s]*[-*•]\s+/, "");
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          bullet: { level: indent >= 2 ? 1 : 0 },
          spacing: { before: 40, after: 40 },
        })
      );
      continue;
    }

    // 번호 리스트
    if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s+/, "");
      paragraphs.push(
        new Paragraph({
          children: parseInlineFormatting(text),
          numbering: { reference: "numbering", level: 0 },
          spacing: { before: 40, after: 40 },
        })
      );
      continue;
    }

    // 일반 텍스트
    paragraphs.push(
      new Paragraph({
        children: parseInlineFormatting(line),
        spacing: { before: 60, after: 60 },
      })
    );
  }

  // 마지막 테이블 처리
  if (inTable && tableRows.length > 0) {
    paragraphs.push(...buildStyledTable(tableHeaders, tableRows));
  }

  return paragraphs;
}

/**
 * 인라인 마크다운 포맷팅 파싱 (볼드, 이탤릭)
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 20,
          font: "맑은 고딕",
          color: COLORS.textDark,
        })
      );
    } else if (part.length > 0) {
      runs.push(
        new TextRun({
          text: part,
          size: 20,
          font: "맑은 고딕",
        })
      );
    }
  }

  if (runs.length === 0) {
    runs.push(new TextRun({ text: " ", size: 20, font: "맑은 고딕" }));
  }

  return runs;
}

/**
 * 인포그래픽 스타일 테이블 (헤더: 딥블루 배경 + 흰색 텍스트)
 */
function buildStyledTable(headers: string[], rows: string[][]): Paragraph[] {
  const result: Paragraph[] = [];

  try {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // 헤더 행 — 딥블루 배경 + 흰색 텍스트
        new TableRow({
          tableHeader: true,
          children: headers.map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: h,
                        bold: true,
                        size: 18,
                        font: "맑은 고딕",
                        color: COLORS.headerText,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.headerBg },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        // 데이터 행 — 짝/홀수 줄 배경색
        ...rows.map(
          (row, idx) =>
            new TableRow({
              children: row.map(
                (cell) =>
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: parseInlineFormatting(cell),
                        spacing: { before: 40, after: 40 },
                      }),
                    ],
                    shading: idx % 2 === 0
                      ? { type: ShadingType.CLEAR, color: "auto", fill: "FFFFFF" }
                      : { type: ShadingType.CLEAR, color: "auto", fill: COLORS.background },
                    verticalAlign: VerticalAlign.CENTER,
                  })
              ),
            })
        ),
      ],
    });

    result.push(
      new Paragraph({ children: [], spacing: { before: 120 } }),
      table as unknown as Paragraph,
      new Paragraph({ children: [], spacing: { after: 120 } })
    );
  } catch {
    result.push(
      new Paragraph({
        children: [
          new TextRun({
            text: [headers.join(" | "), ...rows.map((r) => r.join(" | "))].join("\n"),
            size: 18,
            font: "맑은 고딕",
          }),
        ],
      })
    );
  }

  return result;
}

/**
 * KPI 하이라이트 카드 (3~4열 테이블 형태)
 * ┌─────────┬─────────┬─────────┐
 * │   💰     │   📈    │   🏢    │
 * │  30억    │  275%   │  15곳   │
 * │  매출    │  성장률  │  고객사  │
 * └─────────┴─────────┴─────────┘
 */
function buildKpiHighlightCards(kpiData: KpiData): Paragraph[] {
  const result: Paragraph[] = [];
  const cards: Array<{ icon: string; value: string; label: string }> = [];

  if (kpiData.revenue) cards.push({ icon: "💰", value: kpiData.revenue, label: "매출" });
  if (kpiData.revenue_growth) cards.push({ icon: "📈", value: kpiData.revenue_growth, label: "성장률" });
  if (kpiData.employees) cards.push({ icon: "👥", value: kpiData.employees, label: "임직원" });
  if (kpiData.tam) cards.push({ icon: "🌍", value: kpiData.tam, label: "TAM" });
  if (kpiData.patents) cards.push({ icon: "📋", value: kpiData.patents, label: "특허" });

  if (cards.length === 0) return result;

  // 최대 4개까지만
  const displayCards = cards.slice(0, 4);

  try {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // 아이콘 행
        new TableRow({
          children: displayCards.map(
            (card) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: card.icon,
                        size: 28,
                        font: "맑은 고딕",
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 80, after: 40 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.highlightBg },
                borders: {
                  top: { style: BorderStyle.SINGLE, size: 2, color: COLORS.highlightBorder },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        // 수치 행
        new TableRow({
          children: displayCards.map(
            (card) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: card.value,
                        bold: true,
                        size: 28,
                        font: "맑은 고딕",
                        color: COLORS.primary,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 40 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.highlightBg },
                borders: {
                  left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        // 라벨 행
        new TableRow({
          children: displayCards.map(
            (card) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: card.label,
                        size: 18,
                        font: "맑은 고딕",
                        color: COLORS.neutral,
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 80 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.highlightBg },
                borders: {
                  bottom: { style: BorderStyle.SINGLE, size: 2, color: COLORS.highlightBorder },
                  left: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  right: { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" },
                  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
                },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
      ],
    });

    result.push(
      new Paragraph({ children: [], spacing: { before: 160 } }),
      new Paragraph({
        children: [
          new TextRun({
            text: "핵심 성과 지표",
            bold: true,
            size: 24,
            font: "맑은 고딕",
            color: COLORS.primary,
          }),
        ],
        spacing: { before: 80, after: 80 },
      }),
      table as unknown as Paragraph,
      new Paragraph({ children: [], spacing: { after: 160 } }),
    );
  } catch {
    // 하이라이트 카드 생성 실패 시 일반 텍스트로
    const text = displayCards.map((c) => `${c.label}: ${c.value}`).join(" | ");
    result.push(
      new Paragraph({
        children: [
          new TextRun({ text, bold: true, size: 20, font: "맑은 고딕" }),
        ],
        spacing: { before: 120, after: 120 },
      })
    );
  }

  return result;
}

/**
 * TAM/SAM/SOM 텍스트 표현 (동심원은 DOCX에서 어려우므로 강조 테이블로)
 */
function buildTamSamSomTable(data: Record<string, unknown>): Paragraph[] {
  const result: Paragraph[] = [];
  const tam = (data as Record<string, string>).tam || "";
  const sam = (data as Record<string, string>).sam || "";
  const som = (data as Record<string, string>).som || "";
  const cagr = (data as Record<string, string>).cagr || "";

  if (!tam && !sam && !som) return result;

  try {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({
          children: ["구분", "시장 규모", "설명"].map(
            (h) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: h, bold: true, size: 18, font: "맑은 고딕", color: COLORS.headerText })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.headerBg },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        ...[
          { label: "TAM", value: tam, desc: "전체 시장 규모 (Total Addressable Market)" },
          { label: "SAM", value: sam, desc: "유효 시장 규모 (Serviceable Addressable Market)" },
          { label: "SOM", value: som, desc: "초기 목표 시장 (Serviceable Obtainable Market)" },
        ].map(
          (row, idx) =>
            new TableRow({
              children: [
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row.label, bold: true, size: 20, font: "맑은 고딕", color: COLORS.primary })],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 40, after: 40 },
                    }),
                  ],
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: idx % 2 === 0 ? "FFFFFF" : COLORS.background },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row.value, bold: true, size: 22, font: "맑은 고딕", color: COLORS.textDark })],
                      alignment: AlignmentType.CENTER,
                      spacing: { before: 40, after: 40 },
                    }),
                  ],
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: idx % 2 === 0 ? "FFFFFF" : COLORS.background },
                  verticalAlign: VerticalAlign.CENTER,
                }),
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [new TextRun({ text: row.desc, size: 18, font: "맑은 고딕", color: COLORS.neutral })],
                      spacing: { before: 40, after: 40 },
                    }),
                  ],
                  shading: { type: ShadingType.CLEAR, color: "auto", fill: idx % 2 === 0 ? "FFFFFF" : COLORS.background },
                  verticalAlign: VerticalAlign.CENTER,
                }),
              ],
            })
        ),
      ],
    });

    result.push(
      new Paragraph({ children: [], spacing: { before: 120 } }),
      table as unknown as Paragraph,
    );

    if (cagr) {
      result.push(
        new Paragraph({
          children: [
            new TextRun({ text: "※ 시장 성장률 (CAGR): ", size: 18, font: "맑은 고딕", color: COLORS.neutral }),
            new TextRun({ text: cagr, bold: true, size: 20, font: "맑은 고딕", color: COLORS.positive }),
          ],
          spacing: { before: 60, after: 120 },
        })
      );
    }
  } catch {
    // fallback
    result.push(
      new Paragraph({
        children: [new TextRun({ text: `TAM: ${tam} | SAM: ${sam} | SOM: ${som}`, bold: true, size: 20, font: "맑은 고딕" })],
      })
    );
  }

  return result;
}

/**
 * 타임라인/로드맵 표 (Q1→Q2→Q3→Q4 형태)
 */
function buildTimelineTable(data: Record<string, unknown>): Paragraph[] {
  const result: Paragraph[] = [];
  const events = (data as { events?: Array<{ date: string; event: string }> }).events;
  if (!events || events.length === 0) return result;

  try {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // 기간 행
        new TableRow({
          children: events.map(
            (e) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: e.date, bold: true, size: 18, font: "맑은 고딕", color: COLORS.headerText })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 60, after: 60 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.secondary },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        // 화살표 행
        new TableRow({
          children: events.map(
            (_e, idx) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: idx < events.length - 1 ? "▼" : "★", size: 20, font: "맑은 고딕", color: COLORS.secondary })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 20, after: 20 },
                  }),
                ],
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
        // 이벤트 행
        new TableRow({
          children: events.map(
            (e) =>
              new TableCell({
                children: [
                  new Paragraph({
                    children: [new TextRun({ text: e.event, size: 18, font: "맑은 고딕", color: COLORS.textDark })],
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 40, after: 60 },
                  }),
                ],
                shading: { type: ShadingType.CLEAR, color: "auto", fill: COLORS.highlightBg },
                verticalAlign: VerticalAlign.CENTER,
              })
          ),
        }),
      ],
    });

    result.push(
      new Paragraph({ children: [], spacing: { before: 120 } }),
      table as unknown as Paragraph,
      new Paragraph({ children: [], spacing: { after: 120 } }),
    );
  } catch {
    // fallback
    for (const e of events) {
      result.push(
        new Paragraph({
          children: [new TextRun({ text: `${e.date}: ${e.event}`, size: 18, font: "맑은 고딕" })],
          bullet: { level: 0 },
        })
      );
    }
  }

  return result;
}

/**
 * 차트 데이터를 DOCX 시각 요소로 변환
 * (DOCX에서는 실제 차트 렌더링이 어려우므로 강조 표/테이블로 표현)
 */
function buildChartElement(chart: ChartDataItem): Paragraph[] {
  const result: Paragraph[] = [];

  // 차트 제목
  result.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `📊 ${chart.title}`,
          bold: true,
          size: 22,
          font: "맑은 고딕",
          color: COLORS.primary,
        }),
      ],
      spacing: { before: 160, after: 80 },
    })
  );

  switch (chart.type) {
    case "tam_sam_som":
      result.push(...buildTamSamSomTable(chart.data));
      break;

    case "timeline":
      result.push(...buildTimelineTable(chart.data));
      break;

    case "highlight_cards": {
      // data.items 또는 data.cards 형태 모두 지원
      const cardData = chart.data as Record<string, unknown>;
      const rawItems = (cardData.items || cardData.cards) as Array<{ icon?: string; label: string; value?: string }> | undefined;
      if (rawItems && rawItems.length > 0) {
        result.push(
          ...buildStyledTable(
            rawItems.map((item) => `${item.icon || ""} ${item.label}`),
            [rawItems.map((item) => item.value || "")]
          )
        );
      }
      break;
    }

    case "comparison_table": {
      const { headers, rows: tableRows } = chart.data as { headers?: string[]; rows?: string[][] };
      if (headers && tableRows) {
        result.push(...buildStyledTable(headers, tableRows));
      }
      break;
    }

    case "bar":
    case "line": {
      // 막대/선 차트 → 데이터 테이블로 표현
      // data.datasets 형태 (실제 AI 출력) 또는 data.labels+values 형태 모두 지원
      const chartDataTyped = chart.data as { labels?: string[]; values?: number[]; datasets?: Array<{ label: string; values: number[] }>; unit?: string };
      if (chartDataTyped.labels && chartDataTyped.datasets && chartDataTyped.datasets.length > 0) {
        const headers = ["항목", ...chartDataTyped.datasets.map((ds) => ds.label)];
        const rows = chartDataTyped.labels.map((l, i) =>
          [l, ...chartDataTyped.datasets!.map((ds) => `${ds.values[i]?.toLocaleString() || "-"}`)]
        );
        result.push(...buildStyledTable(headers, rows));
      } else if (chartDataTyped.labels && chartDataTyped.values) {
        const unitStr = chartDataTyped.unit || "";
        result.push(
          ...buildStyledTable(
            ["항목", "값"],
            chartDataTyped.labels.map((l, i) => [l, `${chartDataTyped.values![i]?.toLocaleString() || "-"}${unitStr}`])
          )
        );
      }
      break;
    }

    case "pie": {
      // 파이 차트 → 비율 테이블
      // data.items 형태 또는 data.labels+values 형태 모두 지원
      const pieData = chart.data as { items?: Array<{ name: string; value: number; unit?: string }>; labels?: string[]; values?: number[] };
      if (pieData.labels && pieData.values) {
        const total = pieData.values.reduce((sum, v) => sum + (v || 0), 0);
        result.push(
          ...buildStyledTable(
            ["항목", "비율"],
            pieData.labels.map((label, i) => [
              label,
              total > 0 ? `${pieData.values![i]}% (${((pieData.values![i] / total) * 100).toFixed(1)}%)` : `${pieData.values![i]}%`,
            ])
          )
        );
      } else if (pieData.items) {
        const total = pieData.items.reduce((sum, item) => sum + (item.value || 0), 0);
        result.push(
          ...buildStyledTable(
            ["항목", "값", "비율"],
            pieData.items.map((item) => [
              item.name,
              `${item.value?.toLocaleString() || "-"}${item.unit || ""}`,
              total > 0 ? `${((item.value / total) * 100).toFixed(1)}%` : "-",
            ])
          )
        );
      }
      break;
    }

    case "pain_points": {
      // 페인포인트 다이어그램 → KPI 카드 형태로 표현
      const { points } = chart.data as { points?: Array<{ icon: string; title: string; value: string; description: string }> };
      if (points && points.length > 0) {
        const kpiLike: KpiData = {};
        points.forEach((p, i) => {
          (kpiLike as Record<string, string>)[`custom_${i}`] = `${p.icon} ${p.value}`;
        });
        // 테이블로 표현
        result.push(
          ...buildStyledTable(
            ["문제점", "핵심 수치", "설명"],
            points.map((p) => [`${p.icon} ${p.title}`, p.value, p.description])
          )
        );
      }
      break;
    }

    case "tco_comparison": {
      // TCO 비교 → 기존 vs 도입 후 테이블
      const tcoData = chart.data as {
        before?: { label: string; total: string; items: Array<{ name: string; value: string }> };
        after?: { label: string; total: string; items: Array<{ name: string; value: string }> };
        saving_rate?: string;
      };
      if (tcoData.before && tcoData.after) {
        const headers = ["비용 항목", tcoData.before.label, tcoData.after.label, "절감 효과"];
        const rows: string[][] = [];
        const beforeItems = tcoData.before.items || [];
        const afterItems = tcoData.after.items || [];
        const maxLen = Math.max(beforeItems.length, afterItems.length);
        for (let i = 0; i < maxLen; i++) {
          rows.push([
            beforeItems[i]?.name || afterItems[i]?.name || "",
            beforeItems[i]?.value || "-",
            afterItems[i]?.value || "-",
            "↓ 절감",
          ]);
        }
        rows.push([`**합계**`, tcoData.before.total, tcoData.after.total, `**${tcoData.saving_rate || ""} 절감**`]);
        result.push(...buildStyledTable(headers, rows));
      }
      break;
    }

    case "step_roadmap": {
      // 단계별 로드맵 → 테이블
      const { steps } = chart.data as { steps?: Array<{ step: number; title: string; period: string; target: string; goal: string }> };
      if (steps && steps.length > 0) {
        result.push(
          ...buildStyledTable(
            ["단계", "전략", "기간", "대상", "목표"],
            steps.map((s) => [`${s.step}단계`, s.title, s.period, s.target, s.goal])
          )
        );
      }
      break;
    }

    case "revenue_model": {
      // 수익 모델 구조도 → 테이블
      const { tracks } = chart.data as { tracks?: Array<{ name: string; subtitle: string; price: string; features: string[] }> };
      if (tracks && tracks.length > 0) {
        result.push(
          ...buildStyledTable(
            ["Track", "모델", "가격", "특징"],
            tracks.map((t) => [t.name, t.subtitle, t.price, t.features.join(", ")])
          )
        );
      }
      break;
    }

    case "org_chart": {
      // 조직도 → 테이블
      const { members } = chart.data as { members?: Array<{ role: string; name: string; title: string; detail: string }> };
      if (members && members.length > 0) {
        result.push(
          ...buildStyledTable(
            ["구분", "성명", "직위/역할", "주요 역량"],
            members.map((m) => [m.role, m.name, m.title, m.detail])
          )
        );
      }
      break;
    }

    case "ecosystem_map": {
      // 협력 생태계 → 테이블
      const { partners } = chart.data as { center?: string; partners?: Array<{ name: string; role: string; detail: string; period: string }> };
      if (partners && partners.length > 0) {
        result.push(
          ...buildStyledTable(
            ["협력기관", "역할", "협력 내용", "기간"],
            partners.map((p) => [p.name, p.role, p.detail, p.period])
          )
        );
      }
      break;
    }

    case "esg_cards": {
      // ESG 카드 → 3컬럼 테이블
      const esgData = chart.data as {
        environment?: { title: string; items: string[] };
        social?: { title: string; items: string[] };
        governance?: { title: string; items: string[] };
      };
      if (esgData.environment || esgData.social || esgData.governance) {
        const maxRows = Math.max(
          esgData.environment?.items?.length || 0,
          esgData.social?.items?.length || 0,
          esgData.governance?.items?.length || 0
        );
        const rows: string[][] = [];
        for (let i = 0; i < maxRows; i++) {
          rows.push([
            esgData.environment?.items?.[i] || "",
            esgData.social?.items?.[i] || "",
            esgData.governance?.items?.[i] || "",
          ]);
        }
        result.push(
          ...buildStyledTable(
            ["🌱 Environment", "🤝 Social", "⚖️ Governance"],
            rows
          )
        );
      }
      break;
    }

    default:
      break;
  }

  return result;
}

/**
 * 차트 이미지를 DOCX Paragraph로 변환
 * PNG 버퍼 → ImageRun → 155mm 너비로 삽입
 */
function buildChartImage(imageResult: ChartImageResult, chartTitle: string): Paragraph[] {
  const result: Paragraph[] = [];

  // 차트 제목
  result.push(
    new Paragraph({
      children: [
        new TextRun({
          text: chartTitle,
          bold: true,
          size: 22,
          font: "맑은 고딕",
          color: COLORS.primary,
        }),
      ],
      spacing: { before: 160, after: 80 },
    })
  );

  // 이미지 삽입 (155mm 너비, 비율 유지)
  const targetWidthMm = 155;
  const aspectRatio = imageResult.height / imageResult.width;
  const targetHeightMm = targetWidthMm * aspectRatio;

  result.push(
    new Paragraph({
      children: [
        new ImageRun({
          data: imageResult.pngBuffer,
          transformation: {
            width: convertMillimetersToTwip(targetWidthMm) / 15, // EMU → DXA → approx points
            height: convertMillimetersToTwip(targetHeightMm) / 15,
          },
          type: "png",
        }),
      ],
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 120 },
    })
  );

  return result;
}

/**
 * 사업계획서를 DOCX Buffer로 변환 (v3 — 차트 이미지 삽입)
 */
export async function buildDocx(opts: DocxOptions): Promise<Buffer> {
  const { title, companyName, sections, chartData, kpiData, templateType } = opts;
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 테마 색상 적용
  const colors = getColors(templateType);

  // 차트 이미지 사전 생성 (chartData가 있을 때만)
  let chartImages: Record<string, ChartImageResult[]> = {};
  if (chartData && Object.keys(chartData).length > 0) {
    try {
      chartImages = await chartsToImages(chartData, templateType);
    } catch (error) {
      console.warn("[docx-builder] 차트 이미지 생성 실패, 테이블 폴백 사용:", error);
    }
  }

  // 섹션별 콘텐츠를 Paragraph로 변환
  const sectionParagraphs: Paragraph[] = [];

  for (const section of sections) {
    // 섹션 제목 (테마 색상 적용)
    sectionParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.section_order}. ${section.section_name}`,
            bold: true,
            size: 28,
            font: "맑은 고딕",
            color: colors.primary,
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 2,
            color: colors.secondary,
          },
        },
      })
    );

    // 첫 번째 섹션(개요)에 KPI 하이라이트 카드 삽입
    if (section.section_order === 1 && kpiData) {
      sectionParagraphs.push(...buildKpiHighlightCards(kpiData));
    }

    // 섹션 차트 준비
    const sectionKey = `section_${section.section_order}`;
    const sectionCharts = chartData?.[sectionKey] || [];
    const sectionImages = chartImages[sectionKey] || [];
    let chartIdx = 0;

    // 차트 삽입 헬퍼
    const insertCharts = (count: number) => {
      for (let i = 0; i < count && chartIdx < sectionCharts.length; i++) {
        const chart = sectionCharts[chartIdx];
        const img = sectionImages[chartIdx];
        if (img && img.pngBuffer.length > 0) {
          sectionParagraphs.push(...buildChartImage(img, chart.title));
        } else {
          sectionParagraphs.push(...buildChartElement(chart));
        }
        chartIdx++;
      }
    };

    // 섹션 콘텐츠 + 차트 인터리빙
    if (section.content) {
      // ## 소제목 기준으로 블록 분할
      const blocks = section.content.split(/(?=^## )/m);
      const chartsPerBlock = sectionCharts.length > 0 && blocks.length > 0
        ? Math.max(1, Math.ceil(sectionCharts.length / blocks.length))
        : 0;

      for (const block of blocks) {
        if (block.trim()) {
          const contentParagraphs = parseMarkdownToParagraphs(block);
          sectionParagraphs.push(...contentParagraphs);
        }
        // 블록 뒤에 차트 삽입 (균등 분배)
        insertCharts(chartsPerBlock);
      }

      // 남은 차트
      insertCharts(sectionCharts.length - chartIdx);
    } else {
      sectionParagraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: "(미작성)",
              italics: true,
              color: "999999",
              size: 20,
              font: "맑은 고딕",
            }),
          ],
        })
      );
    }

    // 섹션 간 여백
    sectionParagraphs.push(
      new Paragraph({ children: [], spacing: { after: 200 } })
    );
  }

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: "numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1)",
              alignment: AlignmentType.LEFT,
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(25),
              bottom: convertMillimetersToTwip(25),
              left: convertMillimetersToTwip(25),
              right: convertMillimetersToTwip(25),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${companyName} | ${title}`,
                    size: 16,
                    color: "999999",
                    font: "맑은 고딕",
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "BizPlan AI로 생성됨",
                    size: 14,
                    color: "BBBBBB",
                    font: "맑은 고딕",
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          // ===== 표지 =====
          new Paragraph({ children: [], spacing: { before: 2000 } }),
          new Paragraph({
            children: [
              new TextRun({
                text: title,
                bold: true,
                size: 52,
                font: "맑은 고딕",
                color: colors.primary,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: companyName,
                size: 32,
                font: "맑은 고딕",
                color: "4A5568",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: today,
                size: 22,
                font: "맑은 고딕",
                color: "718096",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [],
            border: {
              bottom: {
                style: BorderStyle.SINGLE,
                size: 3,
                color: colors.secondary,
              },
            },
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "본 사업계획서는 BizPlan AI를 활용하여 자동 생성되었습니다.",
                size: 18,
                color: "A0AEC0",
                font: "맑은 고딕",
                italics: true,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),

          // 페이지 나누기
          new Paragraph({
            children: [new PageBreak()],
          }),

          // ===== 목차 =====
          new Paragraph({
            children: [
              new TextRun({
                text: "목 차",
                bold: true,
                size: 36,
                font: "맑은 고딕",
                color: colors.primary,
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 400 },
          }),
          ...sections.map(
            (s) =>
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${s.section_order}. ${s.section_name}`,
                    size: 22,
                    font: "맑은 고딕",
                  }),
                ],
                spacing: { before: 100, after: 100 },
              })
          ),

          // 페이지 나누기
          new Paragraph({
            children: [new PageBreak()],
          }),

          // ===== 본문 =====
          ...sectionParagraphs,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
