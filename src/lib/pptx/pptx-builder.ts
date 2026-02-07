/**
 * PPTX 빌더 — pptxgenjs를 사용한 IR PPT 생성
 */

import PptxGenJS from "pptxgenjs";
import { SlideType, SLIDE_LABELS } from "@/lib/ai/prompts/ir";

interface SlideData {
  slide_type: SlideType;
  title: string;
  content: {
    headline?: string;
    subtext?: string;
    bullets?: string[];
    data?: Record<string, any>;
  };
  notes?: string;
}

interface PptxOptions {
  companyName: string;
  template?: "minimal" | "tech" | "classic";
  slides: SlideData[];
}

// 템플릿별 색상 설정
const TEMPLATES = {
  minimal: {
    primary: "2563EB", // blue-600
    secondary: "1E40AF", // blue-800
    accent: "3B82F6", // blue-500
    bg: "FFFFFF",
    textDark: "1F2937",
    textLight: "6B7280",
  },
  tech: {
    primary: "7C3AED", // violet-600
    secondary: "5B21B6", // violet-800
    accent: "8B5CF6", // violet-500
    bg: "0F172A", // slate-900
    textDark: "FFFFFF",
    textLight: "94A3B8",
  },
  classic: {
    primary: "DC2626", // red-600
    secondary: "991B1B", // red-800
    accent: "EF4444", // red-500
    bg: "FFFFFF",
    textDark: "1F2937",
    textLight: "6B7280",
  },
};

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
      // 표지
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
      // 일반 슬라이드
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
      slide.addShape(pptx.ShapeType.rect, {
        x: 0.5,
        y: 1.0,
        w: 1.5,
        h: 0.04,
        fill: { color: colors.accent },
      });

      // 헤드라인
      let yPos = 1.3;
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

      // 불릿 포인트
      if (slideData.content.bullets && slideData.content.bullets.length > 0) {
        const bulletText = slideData.content.bullets
          .map((b) => `• ${b}`)
          .join("\n");

        slide.addText(bulletText, {
          x: 0.5,
          y: yPos,
          w: 9,
          h: 3.0,
          fontSize: 14,
          color: colors.textDark,
          fontFace: "Arial",
          lineSpacingMultiple: 1.5,
          valign: "top",
        });
      }

      // 페이지 번호
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
