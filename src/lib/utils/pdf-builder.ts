/**
 * 사업계획서 PDF 생성 유틸리티 (v2 — 차트 이미지 삽입)
 * jsPDF를 사용하여 서버사이드에서 PDF 생성
 */

import jsPDF from "jspdf";
import { chartsToImages, ChartImageResult } from "@/lib/charts/chart-to-image";
import { getThemeForTemplate } from "@/lib/charts/themes";
import type { ChartDataItem } from "@/lib/charts/svg-renderer";

interface PdfOptions {
  title: string;
  companyName: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
  chartData?: Record<string, ChartDataItem[]>;
  kpiData?: Record<string, unknown>;
  templateType?: string;
}

/**
 * 텍스트를 maxWidth에 맞게 줄바꿈 처리
 */
function wrapText(
  doc: jsPDF,
  text: string,
  maxWidth: number
): string[] {
  return doc.splitTextToSize(text, maxWidth);
}

/**
 * 마크다운 텍스트에서 간단한 포맷 제거 (PDF용)
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** → bold
    .replace(/\*([^*]+)\*/g, "$1") // *italic* → italic
    .replace(/#{1,6}\s/g, "") // ## heading → heading
    .replace(/^[-*•]\s+/gm, "• ") // - item → • item
    .replace(/^\d+\.\s+/gm, (match) => match) // 번호리스트 유지
    .replace(/---/g, "") // 구분선 제거
    .replace(/\|/g, " "); // 테이블 구분자 제거
}

/** hex 색상 → RGB 배열 */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

/**
 * 차트 이미지를 PDF에 삽입 + 페이지 넘김 처리
 */
function addChartImageToPdf(
  doc: jsPDF,
  img: ChartImageResult,
  y: number,
  margin: number,
  pageWidth: number,
  pageHeight: number,
  contentWidth: number,
  companyName: string,
  title: string,
  themeColor: [number, number, number]
): number {
  // 이미지 크기 계산 (컨텐츠 너비에 맞추기, mm 단위)
  const imgWidthMm = contentWidth;
  const aspectRatio = img.height / img.width;
  const imgHeightMm = imgWidthMm * aspectRatio;

  // 페이지 넘김 체크 (이미지 + 여백)
  if (y + imgHeightMm + 15 > pageHeight - margin) {
    doc.addPage();
    y = margin;

    // 헤더
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `${companyName} | ${title}`,
      pageWidth - margin,
      margin - 5,
      { align: "right" }
    );
  }

  // 차트 제목
  doc.setFontSize(11);
  doc.setTextColor(...themeColor);
  doc.text(img.title, margin, y);
  y += 5;

  // PNG 이미지 삽입
  const base64 = img.pngBuffer.toString("base64");
  const imgData = `data:image/png;base64,${base64}`;
  doc.addImage(imgData, "PNG", margin, y, imgWidthMm, imgHeightMm);
  y += imgHeightMm + 8;

  return y;
}

/**
 * 사업계획서를 PDF ArrayBuffer로 변환
 */
export async function buildPdf(opts: PdfOptions): Promise<ArrayBuffer> {
  const { title, companyName, sections, chartData, templateType } = opts;
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 테마 색상
  const theme = getThemeForTemplate(templateType);
  const primaryRgb = hexToRgb(theme.primary);
  const accentRgb = hexToRgb(theme.chartColors[1] || theme.accent);

  // 차트 이미지 사전 생성
  let chartImages: Record<string, ChartImageResult[]> = {};
  if (chartData && Object.keys(chartData).length > 0) {
    try {
      chartImages = await chartsToImages(chartData, templateType);
    } catch (error) {
      console.warn("[pdf-builder] 차트 이미지 생성 실패:", error);
    }
  }

  // A4 사이즈 PDF 생성
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 25;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFont("Helvetica");

  // ===== 표지 =====
  y = 80;

  // 제목 (테마 색상)
  doc.setFontSize(28);
  doc.setTextColor(...primaryRgb);
  const titleLines = wrapText(doc, title, contentWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: "center" });
  y += titleLines.length * 12 + 10;

  // 회사명
  doc.setFontSize(16);
  doc.setTextColor(74, 85, 104);
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 15;

  // 날짜
  doc.setFontSize(11);
  doc.setTextColor(113, 128, 150);
  doc.text(today, pageWidth / 2, y, { align: "center" });
  y += 20;

  // 구분선 (테마 색상)
  doc.setDrawColor(...accentRgb);
  doc.setLineWidth(0.5);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);
  y += 15;

  // 부제
  doc.setFontSize(9);
  doc.setTextColor(160, 174, 192);
  doc.text(
    "BizPlan AI - Auto Generated Business Plan",
    pageWidth / 2,
    y,
    { align: "center" }
  );

  // ===== 목차 페이지 =====
  doc.addPage();
  y = margin;

  doc.setFontSize(20);
  doc.setTextColor(...primaryRgb);
  doc.text("Table of Contents", pageWidth / 2, y + 10, { align: "center" });
  y += 30;

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  for (const section of sections) {
    doc.text(
      `${section.section_order}. ${section.section_name}`,
      margin + 10,
      y
    );
    y += 8;
  }

  // ===== 본문 =====
  for (const section of sections) {
    doc.addPage();
    y = margin;

    // 섹션 제목 (테마 색상)
    doc.setFontSize(16);
    doc.setTextColor(...primaryRgb);
    const sectionTitle = `${section.section_order}. ${section.section_name}`;
    doc.text(sectionTitle, margin, y + 5);
    y += 12;

    // 제목 아래 구분선 (테마 색상)
    doc.setDrawColor(...accentRgb);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // 섹션 내용
    if (section.content) {
      const cleanContent = stripMarkdown(section.content);
      const lines = cleanContent.split("\n");

      doc.setFontSize(10);
      doc.setTextColor(50, 50, 50);

      for (const line of lines) {
        if (line.trim() === "") {
          y += 3;
          continue;
        }

        const wrappedLines = wrapText(doc, line, contentWidth);

        for (const wLine of wrappedLines) {
          // 페이지 넘김 체크
          if (y + 6 > pageHeight - margin) {
            doc.addPage();
            y = margin;

            // 헤더 표시
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
              `${companyName} | ${title}`,
              pageWidth - margin,
              margin - 5,
              { align: "right" }
            );
            doc.setFontSize(10);
            doc.setTextColor(50, 50, 50);
          }

          doc.text(wLine, margin, y);
          y += 5;
        }
        y += 1; // 문단 간격
      }
    } else {
      doc.setFontSize(10);
      doc.setTextColor(150, 150, 150);
      doc.text("(Not yet written)", margin, y);
    }

    // 섹션 차트 이미지 삽입
    const sectionKey = `section_${section.section_order}`;
    const sectionImages = chartImages[sectionKey];
    if (sectionImages && sectionImages.length > 0) {
      y += 5;
      for (const img of sectionImages) {
        y = addChartImageToPdf(
          doc, img, y, margin, pageWidth, pageHeight,
          contentWidth, companyName, title, primaryRgb
        );
      }
    }
  }

  return doc.output("arraybuffer");
}
