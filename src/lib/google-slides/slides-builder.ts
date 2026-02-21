/**
 * Google Slides 빌더
 * ir-generator.ts의 슬라이드 데이터를 Google Slides 프레젠테이션으로 변환
 *
 * pptx-builder.ts와 동일한 인터페이스를 제공하여 교체 용이
 */

import { slides_v1 } from "googleapis";
import {
  createPresentation,
  batchUpdate,
  sharePresentation,
  exportAsPptx,
  exportAsPdf,
} from "./client";

// ===== 템플릿 색상 (pptx-builder.ts와 동일) =====
const TEMPLATES: Record<
  string,
  {
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    textDark: string;
    textLight: string;
    chartColors: string[];
  }
> = {
  minimal: {
    primary: "1A1A2E",
    secondary: "023793",
    accent: "4361EE",
    bg: "FFFFFF",
    textDark: "1A1A2E",
    textLight: "FFFFFF",
    chartColors: ["023793", "4361EE", "7C3AED", "EC4899", "F59E0B"],
  },
  tech: {
    primary: "0D1117",
    secondary: "58A6FF",
    accent: "7EE787",
    bg: "0D1117",
    textDark: "C9D1D9",
    textLight: "FFFFFF",
    chartColors: ["58A6FF", "7EE787", "D2A8FF", "FFA657", "F778BA"],
  },
  classic: {
    primary: "2C3E50",
    secondary: "003366",
    accent: "E74C3C",
    bg: "FFFFFF",
    textDark: "2C3E50",
    textLight: "FFFFFF",
    chartColors: ["003366", "E74C3C", "27AE60", "F39C12", "8E44AD"],
  },
  professional: {
    primary: "0F2B46",
    secondary: "1B4F72",
    accent: "D4A843",
    bg: "FFFFFF",
    textDark: "0F2B46",
    textLight: "FFFFFF",
    chartColors: ["1B4F72", "D4A843", "2E86C1", "E67E22", "1ABC9C"],
  },
  vibrant: {
    primary: "2D1B69",
    secondary: "6C3CE0",
    accent: "FF6B6B",
    bg: "FFFFFF",
    textDark: "2D1B69",
    textLight: "FFFFFF",
    chartColors: ["6C3CE0", "FF6B6B", "4ECDC4", "FFE66D", "A8E6CF"],
  },
};

interface SlideInput {
  slide_type: string;
  title: string;
  content: Record<string, unknown>;
  notes: string | null;
}

interface BuildGoogleSlidesOptions {
  companyName: string;
  template: string;
  slides: SlideInput[];
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

interface BuildGoogleSlidesResult {
  presentationId: string;
  url: string;        // Google Slides 편집 URL
  viewUrl: string;    // 뷰어 URL
  pptxBuffer?: Buffer;
}

// ===== 헬퍼: HEX → Google Slides RGB 색상 =====
function hexToRgb(hex: string): slides_v1.Schema$RgbColor {
  const clean = hex.replace("#", "");
  return {
    red: parseInt(clean.substring(0, 2), 16) / 255,
    green: parseInt(clean.substring(2, 4), 16) / 255,
    blue: parseInt(clean.substring(4, 6), 16) / 255,
  };
}

function solidFill(hex: string): slides_v1.Schema$OptionalColor {
  return {
    opaqueColor: {
      rgbColor: hexToRgb(hex),
    },
  };
}

// EMU (English Metric Units) 변환: 1 inch = 914400 EMU
const EMU = 914400;
const inchToEmu = (inches: number) => Math.round(inches * EMU);

// 슬라이드 라벨
const SLIDE_LABELS: Record<string, string> = {
  cover: "표지",
  problem: "Problem",
  solution: "Solution",
  market: "Market Size",
  business_model: "Business Model",
  traction: "Traction",
  competition: "Competition",
  tech: "Technology",
  team: "Team",
  financials: "Financials",
  ask: "The Ask",
  roadmap: "Roadmap",
};

/**
 * Google Slides 프레젠테이션 빌드
 */
export async function buildGoogleSlides(
  opts: BuildGoogleSlidesOptions
): Promise<BuildGoogleSlidesResult> {
  const base = TEMPLATES[opts.template] || TEMPLATES.minimal;
  const colors = opts.customColors
    ? {
        primary: opts.customColors.primary,
        secondary: opts.customColors.secondary,
        accent: opts.customColors.accent,
        bg: opts.customColors.bg || base.bg,
        textDark: opts.customColors.textDark || base.textDark,
        textLight: opts.customColors.textLight || base.textLight,
        chartColors: opts.customColors.chartColors || base.chartColors,
      }
    : base;

  // 1. 프레젠테이션 생성
  const { presentationId, url } = await createPresentation(
    `${opts.companyName} IR Pitch Deck`
  );

  // 2. 기본 슬라이드 (자동 생성되는 첫 슬라이드) 삭제
  // 새 프레젠테이션에는 빈 슬라이드 1장이 자동 생성됨
  // 기본 슬라이드 ID는 "p"
  const requests: slides_v1.Schema$Request[] = [
    { deleteObject: { objectId: "p" } },
  ];

  // 3. 슬라이드 생성
  const slideIds: string[] = [];

  for (let i = 0; i < opts.slides.length; i++) {
    const slide = opts.slides[i];
    const slideId = `slide_${i}`;
    slideIds.push(slideId);

    if (slide.slide_type === "cover") {
      buildCoverSlide(requests, slideId, slide, opts.companyName, colors);
    } else {
      buildContentSlide(requests, slideId, slide, i, opts.companyName, colors);
    }
  }

  // 4. 감사 슬라이드 (Thank You)
  const closingId = `slide_closing`;
  buildClosingSlide(requests, closingId, opts.companyName, colors);

  // 5. batch update 실행
  try {
    await batchUpdate(presentationId, requests);
  } catch (err) {
    console.error("[Google Slides] Batch update 실패:", err);
    throw err;
  }

  // 6. 공유 설정 (누구나 보기 가능)
  await sharePresentation(presentationId, "reader");

  const viewUrl = `https://docs.google.com/presentation/d/${presentationId}/preview`;

  return {
    presentationId,
    url,
    viewUrl,
  };
}

// ===== 표지 슬라이드 =====
function buildCoverSlide(
  requests: slides_v1.Schema$Request[],
  slideId: string,
  slide: SlideInput,
  companyName: string,
  colors: typeof TEMPLATES.minimal
) {
  const content = slide.content;
  const headline = (content.headline as string) || "";
  const subtext = (content.subtext as string) || new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" });

  // 슬라이드 생성
  requests.push({
    createSlide: {
      objectId: slideId,
      slideLayoutReference: { predefinedLayout: "BLANK" },
    },
  });

  // 배경색 (primary)
  requests.push({
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: {
            color: solidFill(colors.primary).opaqueColor,
          },
        },
      },
      fields: "pageBackgroundFill",
    },
  });

  // IR DECK 뱃지
  const badgeId = `${slideId}_badge`;
  requests.push({
    createShape: {
      objectId: badgeId,
      shapeType: "ROUND_RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(1.2), unit: "EMU" },
          height: { magnitude: inchToEmu(0.35), unit: "EMU" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToEmu(0.6),
          translateY: inchToEmu(1.5),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: badgeId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: { color: solidFill(colors.accent).opaqueColor, alpha: 0.3 },
        },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.accent).opaqueColor, alpha: 0.5 } }, weight: { magnitude: 1, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });
  requests.push({
    insertText: { objectId: badgeId, text: "IR DECK", insertionIndex: 0 },
  });
  requests.push({
    updateTextStyle: {
      objectId: badgeId,
      style: {
        fontSize: { magnitude: 10, unit: "PT" },
        fontFamily: "Arial",
        bold: true,
        foregroundColor: solidFill(colors.textLight),
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,bold,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: badgeId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });

  // 회사명 (큰 텍스트)
  const titleId = `${slideId}_title`;
  requests.push({
    createShape: {
      objectId: titleId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(8), unit: "EMU" },
          height: { magnitude: inchToEmu(1), unit: "EMU" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToEmu(0.6),
          translateY: inchToEmu(2.1),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    insertText: { objectId: titleId, text: companyName, insertionIndex: 0 },
  });
  requests.push({
    updateTextStyle: {
      objectId: titleId,
      style: {
        fontSize: { magnitude: 40, unit: "PT" },
        fontFamily: "Arial",
        bold: true,
        foregroundColor: solidFill(colors.textLight),
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,bold,foregroundColor",
    },
  });

  // 액센트 바
  const accentBarId = `${slideId}_accentbar`;
  requests.push({
    createShape: {
      objectId: accentBarId,
      shapeType: "RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(1.5), unit: "EMU" },
          height: { magnitude: inchToEmu(0.04), unit: "EMU" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToEmu(0.6),
          translateY: inchToEmu(3.2),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: accentBarId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: { color: solidFill(colors.accent).opaqueColor },
        },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.accent).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });

  // 헤드라인
  if (headline) {
    const headlineId = `${slideId}_headline`;
    requests.push({
      createShape: {
        objectId: headlineId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: inchToEmu(8), unit: "EMU" },
            height: { magnitude: inchToEmu(0.6), unit: "EMU" },
          },
          transform: {
            scaleX: 1,
            scaleY: 1,
            translateX: inchToEmu(0.6),
            translateY: inchToEmu(3.45),
            unit: "EMU",
          },
        },
      },
    });
    requests.push({
      insertText: { objectId: headlineId, text: headline, insertionIndex: 0 },
    });
    requests.push({
      updateTextStyle: {
        objectId: headlineId,
        style: {
          fontSize: { magnitude: 18, unit: "PT" },
          fontFamily: "Arial",
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.88, green: 0.91, blue: 1 } } },
        },
        textRange: { type: "ALL" },
        fields: "fontSize,fontFamily,foregroundColor",
      },
    });
  }

  // 날짜
  const dateId = `${slideId}_date`;
  const dateStr = subtext || new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long" });
  requests.push({
    createShape: {
      objectId: dateId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(3), unit: "EMU" },
          height: { magnitude: inchToEmu(0.35), unit: "EMU" },
        },
        transform: {
          scaleX: 1,
          scaleY: 1,
          translateX: inchToEmu(6.5),
          translateY: inchToEmu(5),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    insertText: { objectId: dateId, text: dateStr, insertionIndex: 0 },
  });
  requests.push({
    updateTextStyle: {
      objectId: dateId,
      style: {
        fontSize: { magnitude: 10, unit: "PT" },
        fontFamily: "Arial",
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.7, green: 0.7, blue: 0.75 } } },
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: dateId,
      style: { alignment: "END" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });
}

// ===== 일반 콘텐츠 슬라이드 =====
function buildContentSlide(
  requests: slides_v1.Schema$Request[],
  slideId: string,
  slide: SlideInput,
  index: number,
  companyName: string,
  colors: typeof TEMPLATES.minimal
) {
  const content = slide.content;
  const headline = (content.headline as string) || "";
  const subtext = (content.subtext as string) || "";
  const bullets = (content.bullets as string[]) || [];
  const stats = (content.stats as Array<{ icon?: string; value: string; label: string }>) || [];

  // 슬라이드 생성
  requests.push({
    createSlide: {
      objectId: slideId,
      slideLayoutReference: { predefinedLayout: "BLANK" },
    },
  });

  // 좌측 액센트 바
  const leftBarId = `${slideId}_leftbar`;
  requests.push({
    createShape: {
      objectId: leftBarId,
      shapeType: "RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(0.06), unit: "EMU" },
          height: { magnitude: inchToEmu(5.63), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: 0, translateY: 0,
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: leftBarId,
      shapeProperties: {
        shapeBackgroundFill: { solidFill: { color: solidFill(colors.primary).opaqueColor } },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.primary).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });

  // 슬라이드 번호 뱃지
  const numStr = String(index).padStart(2, "0");
  const numBadgeId = `${slideId}_num`;
  requests.push({
    createShape: {
      objectId: numBadgeId,
      shapeType: "ROUND_RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(0.5), unit: "EMU" },
          height: { magnitude: inchToEmu(0.3), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(0.35),
          translateY: inchToEmu(0.35),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: numBadgeId,
      shapeProperties: {
        shapeBackgroundFill: { solidFill: { color: solidFill(colors.secondary).opaqueColor, alpha: 0.15 } },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.secondary).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });
  requests.push({ insertText: { objectId: numBadgeId, text: numStr, insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: numBadgeId,
      style: {
        fontSize: { magnitude: 9, unit: "PT" },
        fontFamily: "Arial",
        bold: true,
        foregroundColor: solidFill(colors.secondary),
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,bold,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: numBadgeId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });

  // 제목
  const titleId = `${slideId}_title`;
  requests.push({
    createShape: {
      objectId: titleId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(8.5), unit: "EMU" },
          height: { magnitude: inchToEmu(0.5), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(1),
          translateY: inchToEmu(0.3),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({ insertText: { objectId: titleId, text: slide.title, insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: titleId,
      style: {
        fontSize: { magnitude: 22, unit: "PT" },
        fontFamily: "Arial",
        bold: true,
        foregroundColor: solidFill(colors.primary),
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,bold,foregroundColor",
    },
  });

  // 구분선
  const divId = `${slideId}_div`;
  requests.push({
    createShape: {
      objectId: divId,
      shapeType: "RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(1.2), unit: "EMU" },
          height: { magnitude: inchToEmu(0.03), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(1),
          translateY: inchToEmu(0.9),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: divId,
      shapeProperties: {
        shapeBackgroundFill: { solidFill: { color: solidFill(colors.accent).opaqueColor } },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.accent).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });

  // 콘텐츠 영역 시작 Y 좌표
  let yPos = 1.15;

  // 통계 카드 (stats가 있으면)
  if (stats.length > 0) {
    const cardWidth = 8.4 / Math.min(stats.length, 4);
    for (let si = 0; si < Math.min(stats.length, 4); si++) {
      const stat = stats[si];
      const cardId = `${slideId}_stat${si}`;

      // 카드 배경
      requests.push({
        createShape: {
          objectId: cardId,
          shapeType: "ROUND_RECTANGLE",
          elementProperties: {
            pageObjectId: slideId,
            size: {
              width: { magnitude: inchToEmu(cardWidth - 0.15), unit: "EMU" },
              height: { magnitude: inchToEmu(0.75), unit: "EMU" },
            },
            transform: {
              scaleX: 1, scaleY: 1,
              translateX: inchToEmu(0.6 + si * cardWidth),
              translateY: inchToEmu(yPos),
              unit: "EMU",
            },
          },
        },
      });
      requests.push({
        updateShapeProperties: {
          objectId: cardId,
          shapeProperties: {
            shapeBackgroundFill: { solidFill: { color: solidFill(colors.secondary).opaqueColor, alpha: 0.08 } },
            outline: { outlineFill: { solidFill: { color: solidFill(colors.secondary).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
          },
          fields: "shapeBackgroundFill,outline",
        },
      });

      // 값 + 라벨
      const statText = `${stat.value}\n${stat.label}`;
      requests.push({ insertText: { objectId: cardId, text: statText, insertionIndex: 0 } });

      // 값 스타일 (bold, 큰 폰트)
      const valueLen = stat.value.length;
      requests.push({
        updateTextStyle: {
          objectId: cardId,
          style: {
            fontSize: { magnitude: 16, unit: "PT" },
            fontFamily: "Arial",
            bold: true,
            foregroundColor: solidFill(colors.primary),
          },
          textRange: { type: "FIXED_RANGE", startIndex: 0, endIndex: valueLen },
          fields: "fontSize,fontFamily,bold,foregroundColor",
        },
      });
      // 라벨 스타일 (작은 폰트)
      requests.push({
        updateTextStyle: {
          objectId: cardId,
          style: {
            fontSize: { magnitude: 9, unit: "PT" },
            fontFamily: "Arial",
            foregroundColor: { opaqueColor: { rgbColor: { red: 0.5, green: 0.5, blue: 0.55 } } },
          },
          textRange: { type: "FIXED_RANGE", startIndex: valueLen + 1, endIndex: statText.length },
          fields: "fontSize,fontFamily,foregroundColor",
        },
      });
      requests.push({
        updateParagraphStyle: {
          objectId: cardId,
          style: { alignment: "CENTER" },
          textRange: { type: "ALL" },
          fields: "alignment",
        },
      });
    }
    yPos += 1.0;
  }

  // 헤드라인
  if (headline) {
    const headId = `${slideId}_headline`;
    requests.push({
      createShape: {
        objectId: headId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: inchToEmu(8.5), unit: "EMU" },
            height: { magnitude: inchToEmu(0.45), unit: "EMU" },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: inchToEmu(1),
            translateY: inchToEmu(yPos),
            unit: "EMU",
          },
        },
      },
    });
    requests.push({ insertText: { objectId: headId, text: headline, insertionIndex: 0 } });
    requests.push({
      updateTextStyle: {
        objectId: headId,
        style: {
          fontSize: { magnitude: 14, unit: "PT" },
          fontFamily: "Arial",
          bold: true,
          foregroundColor: solidFill(colors.textDark),
        },
        textRange: { type: "ALL" },
        fields: "fontSize,fontFamily,bold,foregroundColor",
      },
    });
    yPos += 0.55;
  }

  // 부가 설명
  if (subtext) {
    const subId = `${slideId}_subtext`;
    requests.push({
      createShape: {
        objectId: subId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: inchToEmu(8.5), unit: "EMU" },
            height: { magnitude: inchToEmu(0.35), unit: "EMU" },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: inchToEmu(1),
            translateY: inchToEmu(yPos),
            unit: "EMU",
          },
        },
      },
    });
    requests.push({ insertText: { objectId: subId, text: subtext, insertionIndex: 0 } });
    requests.push({
      updateTextStyle: {
        objectId: subId,
        style: {
          fontSize: { magnitude: 11, unit: "PT" },
          fontFamily: "Arial",
          foregroundColor: { opaqueColor: { rgbColor: { red: 0.45, green: 0.45, blue: 0.5 } } },
        },
        textRange: { type: "ALL" },
        fields: "fontSize,fontFamily,foregroundColor",
      },
    });
    yPos += 0.45;
  }

  // 불릿 포인트
  if (bullets.length > 0) {
    const bulletId = `${slideId}_bullets`;
    const bulletText = bullets.map((b) => `• ${b}`).join("\n");
    requests.push({
      createShape: {
        objectId: bulletId,
        shapeType: "TEXT_BOX",
        elementProperties: {
          pageObjectId: slideId,
          size: {
            width: { magnitude: inchToEmu(8.5), unit: "EMU" },
            height: { magnitude: inchToEmu(Math.max(1, bullets.length * 0.35)), unit: "EMU" },
          },
          transform: {
            scaleX: 1, scaleY: 1,
            translateX: inchToEmu(1),
            translateY: inchToEmu(yPos + 0.1),
            unit: "EMU",
          },
        },
      },
    });
    requests.push({ insertText: { objectId: bulletId, text: bulletText, insertionIndex: 0 } });
    requests.push({
      updateTextStyle: {
        objectId: bulletId,
        style: {
          fontSize: { magnitude: 12, unit: "PT" },
          fontFamily: "Arial",
          foregroundColor: solidFill("444444"),
        },
        textRange: { type: "ALL" },
        fields: "fontSize,fontFamily,foregroundColor",
      },
    });
    requests.push({
      updateParagraphStyle: {
        objectId: bulletId,
        style: { lineSpacing: 160 },
        textRange: { type: "ALL" },
        fields: "lineSpacing",
      },
    });
  }

  // 하단 바
  const bottomBarId = `${slideId}_bottombar`;
  requests.push({
    createShape: {
      objectId: bottomBarId,
      shapeType: "RECTANGLE",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(10), unit: "EMU" },
          height: { magnitude: inchToEmu(0.35), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: 0,
          translateY: inchToEmu(5.28),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({
    updateShapeProperties: {
      objectId: bottomBarId,
      shapeProperties: {
        shapeBackgroundFill: { solidFill: { color: solidFill(colors.primary).opaqueColor } },
        outline: { outlineFill: { solidFill: { color: solidFill(colors.primary).opaqueColor } }, weight: { magnitude: 0, unit: "PT" } },
      },
      fields: "shapeBackgroundFill,outline",
    },
  });

  // 하단 텍스트: 회사명 | 슬라이드 라벨 | 페이지 번호
  const label = SLIDE_LABELS[slide.slide_type] || slide.slide_type;
  const footerText = `${companyName}     |     ${label}     |     ${index + 1}`;
  requests.push({ insertText: { objectId: bottomBarId, text: footerText, insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: bottomBarId,
      style: {
        fontSize: { magnitude: 8, unit: "PT" },
        fontFamily: "Arial",
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.7, green: 0.7, blue: 0.75 } } },
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: bottomBarId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });

  // 발표자 노트
  if (slide.notes) {
    requests.push({
      insertText: {
        objectId: `${slideId}_notes`,
        text: slide.notes,
        insertionIndex: 0,
      },
    });
  }
}

// ===== 감사 슬라이드 =====
function buildClosingSlide(
  requests: slides_v1.Schema$Request[],
  slideId: string,
  companyName: string,
  colors: typeof TEMPLATES.minimal
) {
  requests.push({
    createSlide: {
      objectId: slideId,
      slideLayoutReference: { predefinedLayout: "BLANK" },
    },
  });

  // 배경색
  requests.push({
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: { color: solidFill(colors.primary).opaqueColor },
        },
      },
      fields: "pageBackgroundFill",
    },
  });

  // Thank You 텍스트
  const tyId = `${slideId}_thankyou`;
  requests.push({
    createShape: {
      objectId: tyId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(8), unit: "EMU" },
          height: { magnitude: inchToEmu(1), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(1),
          translateY: inchToEmu(1.8),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({ insertText: { objectId: tyId, text: "Thank You", insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: tyId,
      style: {
        fontSize: { magnitude: 48, unit: "PT" },
        fontFamily: "Arial",
        bold: true,
        foregroundColor: solidFill(colors.textLight),
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,bold,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: tyId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });

  // 회사명
  const cnId = `${slideId}_company`;
  requests.push({
    createShape: {
      objectId: cnId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(8), unit: "EMU" },
          height: { magnitude: inchToEmu(0.5), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(1),
          translateY: inchToEmu(2.9),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({ insertText: { objectId: cnId, text: companyName, insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: cnId,
      style: {
        fontSize: { magnitude: 20, unit: "PT" },
        fontFamily: "Arial",
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.88, green: 0.91, blue: 1 } } },
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: cnId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });

  // Generated by BizPlan AI
  const wmId = `${slideId}_watermark`;
  requests.push({
    createShape: {
      objectId: wmId,
      shapeType: "TEXT_BOX",
      elementProperties: {
        pageObjectId: slideId,
        size: {
          width: { magnitude: inchToEmu(4), unit: "EMU" },
          height: { magnitude: inchToEmu(0.3), unit: "EMU" },
        },
        transform: {
          scaleX: 1, scaleY: 1,
          translateX: inchToEmu(3),
          translateY: inchToEmu(5),
          unit: "EMU",
        },
      },
    },
  });
  requests.push({ insertText: { objectId: wmId, text: "Generated by BizPlan AI", insertionIndex: 0 } });
  requests.push({
    updateTextStyle: {
      objectId: wmId,
      style: {
        fontSize: { magnitude: 8, unit: "PT" },
        fontFamily: "Arial",
        italic: true,
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.5, green: 0.5, blue: 0.55 } } },
      },
      textRange: { type: "ALL" },
      fields: "fontSize,fontFamily,italic,foregroundColor",
    },
  });
  requests.push({
    updateParagraphStyle: {
      objectId: wmId,
      style: { alignment: "CENTER" },
      textRange: { type: "ALL" },
      fields: "alignment",
    },
  });
}

/**
 * Google Slides에서 PPTX 내보내기
 */
export async function exportGoogleSlidesAsPptx(
  presentationId: string
): Promise<Buffer> {
  return exportAsPptx(presentationId);
}

/**
 * Google Slides에서 PDF 내보내기
 */
export async function exportGoogleSlidesAsPdf(
  presentationId: string
): Promise<Buffer> {
  return exportAsPdf(presentationId);
}
