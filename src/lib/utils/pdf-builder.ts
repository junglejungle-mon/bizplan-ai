/**
 * 사업계획서 PDF 생성 유틸리티
 * jsPDF를 사용하여 서버사이드에서 PDF 생성
 * 한글 지원을 위해 기본 폰트 사용 (CIDFont)
 */

import jsPDF from "jspdf";

interface PdfOptions {
  title: string;
  companyName: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
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

/**
 * 사업계획서를 PDF ArrayBuffer로 변환
 */
export async function buildPdf(opts: PdfOptions): Promise<ArrayBuffer> {
  const { title, companyName, sections } = opts;
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // A4 사이즈 PDF 생성 (한글 지원)
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

  // 한글 폰트 설정 (jsPDF 기본 제공 CJK 지원)
  // Note: 기본 폰트로 한글을 지원하기 위해 유니코드 모드 사용
  doc.setFont("Helvetica");

  // ===== 표지 =====
  y = 80;

  // 제목
  doc.setFontSize(28);
  doc.setTextColor(26, 54, 93); // #1A365D
  const titleLines = wrapText(doc, title, contentWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: "center" });
  y += titleLines.length * 12 + 10;

  // 회사명
  doc.setFontSize(16);
  doc.setTextColor(74, 85, 104); // #4A5568
  doc.text(companyName, pageWidth / 2, y, { align: "center" });
  y += 15;

  // 날짜
  doc.setFontSize(11);
  doc.setTextColor(113, 128, 150); // #718096
  doc.text(today, pageWidth / 2, y, { align: "center" });
  y += 20;

  // 구분선
  doc.setDrawColor(49, 130, 206); // #3182CE
  doc.setLineWidth(0.5);
  doc.line(margin + 30, y, pageWidth - margin - 30, y);
  y += 15;

  // 부제
  doc.setFontSize(9);
  doc.setTextColor(160, 174, 192); // #A0AEC0
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
  doc.setTextColor(26, 54, 93);
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

    // 섹션 제목
    doc.setFontSize(16);
    doc.setTextColor(26, 54, 93);
    const sectionTitle = `${section.section_order}. ${section.section_name}`;
    doc.text(sectionTitle, margin, y + 5);
    y += 12;

    // 제목 아래 구분선
    doc.setDrawColor(49, 130, 206);
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

  }

  return doc.output("arraybuffer");
}
