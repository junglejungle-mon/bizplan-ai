/**
 * 마크다운 → DOCX 변환 유틸리티
 * docx 라이브러리를 사용하여 사업계획서를 DOCX 파일로 생성
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
} from "docx";

interface DocxOptions {
  title: string;
  companyName: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
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
      // 테이블 종료 처리
      if (inTable && tableRows.length > 0) {
        paragraphs.push(...buildTable(tableHeaders, tableRows));
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

      // 구분선 (---|---) 건너뛰기
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

    // 테이블 종료 (테이블 아닌 줄 도달)
    if (inTable && tableRows.length > 0) {
      paragraphs.push(...buildTable(tableHeaders, tableRows));
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
              size: 24, // 12pt
              font: "맑은 고딕",
            }),
          ],
          spacing: { before: 240, after: 120 },
        })
      );
      continue;
    }

    // ## 중제목 (H2) - 보통 섹션 안에서 서브 타이틀
    if (line.startsWith("## ")) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.replace("## ", ""),
              bold: true,
              size: 26, // 13pt
              font: "맑은 고딕",
            }),
          ],
          spacing: { before: 300, after: 120 },
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

    // 불릿 리스트 (-, *, •)
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
    paragraphs.push(...buildTable(tableHeaders, tableRows));
  }

  return paragraphs;
}

/**
 * 인라인 마크다운 포맷팅 파싱 (볼드, 이탤릭)
 */
function parseInlineFormatting(text: string): TextRun[] {
  const runs: TextRun[] = [];
  // **bold** 와 일반 텍스트 분리
  const parts = text.split(/(\*\*[^*]+\*\*)/g);

  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      runs.push(
        new TextRun({
          text: part.slice(2, -2),
          bold: true,
          size: 20, // 10pt
          font: "맑은 고딕",
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
 * 마크다운 테이블을 DOCX Table로 변환
 */
function buildTable(headers: string[], rows: string[][]): Paragraph[] {
  const result: Paragraph[] = [];

  try {
    const table = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        // 헤더 행
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
                      }),
                    ],
                    alignment: AlignmentType.CENTER,
                  }),
                ],
                shading: { color: "auto", fill: "E8EDF3" },
              })
          ),
        }),
        // 데이터 행
        ...rows.map(
          (row) =>
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
                  })
              ),
            })
        ),
      ],
    });

    result.push(
      new Paragraph({ children: [], spacing: { before: 120 } }), // 테이블 위 간격
      table as unknown as Paragraph, // docx 라이브러리 타입 호환
      new Paragraph({ children: [], spacing: { after: 120 } }) // 테이블 아래 간격
    );
  } catch {
    // 테이블 변환 실패 시 일반 텍스트로 표시
    result.push(
      new Paragraph({
        children: [
          new TextRun({
            text: [headers.join(" | "), ...rows.map((r) => r.join(" | "))].join(
              "\n"
            ),
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
 * 사업계획서를 DOCX Buffer로 변환
 */
export async function buildDocx(opts: DocxOptions): Promise<Buffer> {
  const { title, companyName, sections } = opts;
  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // 섹션별 콘텐츠를 Paragraph로 변환
  const sectionParagraphs: Paragraph[] = [];

  for (const section of sections) {
    // 섹션 제목
    sectionParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `${section.section_order}. ${section.section_name}`,
            bold: true,
            size: 28, // 14pt
            font: "맑은 고딕",
            color: "1A365D",
          }),
        ],
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 400, after: 200 },
        border: {
          bottom: {
            style: BorderStyle.SINGLE,
            size: 2,
            color: "3182CE",
          },
        },
      })
    );

    // 섹션 콘텐츠
    if (section.content) {
      const contentParagraphs = parseMarkdownToParagraphs(section.content);
      sectionParagraphs.push(...contentParagraphs);
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
                size: 52, // 26pt
                font: "맑은 고딕",
                color: "1A365D",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: companyName,
                size: 32, // 16pt
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
                color: "3182CE",
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
                color: "1A365D",
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
