/**
 * pptx-automizer 기반 템플릿 빌더
 *
 * 1단계: 기존 pptxgenjs 빌더 (pptx-builder.ts)를 메인 엔진으로 유지
 * 2단계: pptx-automizer로 .pptx 템플릿 파일 지원 (디자이너 제작 템플릿)
 *
 * 이 파일은 2단계를 위한 인프라입니다.
 *
 * === 사용 방법 ===
 * 1. public/templates/ 에 디자이너가 만든 .pptx 파일 배치
 *    - 각 슬라이드에 {COMPANY_NAME}, {HEADLINE} 등 플레이스홀더 포함
 * 2. buildFromTemplate()에 데이터를 전달하면 텍스트가 치환됨
 */

import { Automizer, ModifyTextHelper } from "pptx-automizer";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

/** modifyElement를 안전하게 호출 (요소가 없어도 에러 무시) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeModify(slideMod: any, elementName: string, modifiers: unknown[]) {
  try {
    slideMod.modifyElement(elementName, modifiers);
  } catch {
    // 해당 이름의 요소가 슬라이드에 없으면 무시
  }
}

// 슬라이드 타입 → 템플릿 슬라이드 인덱스 매핑
const SLIDE_TYPE_MAP: Record<string, number> = {
  cover: 1,
  problem: 2,
  solution: 3,
  market: 4,
  business_model: 5,
  traction: 6,
  competition: 7,
  tech: 8,
  team: 9,
  financials: 10,
  ask: 11,
  roadmap: 12,
};

// 슬라이드 타입별 존재하는 요소 목록 (pptx-automizer는 없는 요소를 수정하면 에러)
const SLIDE_ELEMENTS: Record<string, Set<string>> = {
  cover: new Set(["CompanyName", "Title", "Headline", "Subtext"]),
  thanks: new Set(["CompanyName", "Subtext"]),
  // content 슬라이드 (2~12)는 모두 동일
  content: new Set(["Title", "Headline", "Subtext", "Bullets", "CompanyName"]),
};

/** 해당 슬라이드 타입에 특정 요소가 존재하는지 확인 */
function hasElement(slideType: string, elementName: string): boolean {
  const elements = SLIDE_ELEMENTS[slideType] || SLIDE_ELEMENTS.content;
  return elements.has(elementName);
}

interface TemplateSlideData {
  slide_type: string;
  title: string;
  content: {
    headline?: string;
    subtext?: string;
    bullets?: string[];
    stats?: Array<{ value: string; label: string }>;
  };
  notes?: string;
}

interface TemplateBuildOptions {
  templateFile: string;  // 템플릿 파일 경로 (public/templates/minimal.pptx 등)
  companyName: string;
  slides: TemplateSlideData[];
}

/**
 * 템플릿 .pptx 파일이 존재하는지 확인
 */
export function hasTemplate(templateName: string): boolean {
  const templatePath = path.join(process.cwd(), "public", "templates", `${templateName}.pptx`);
  return fs.existsSync(templatePath);
}

/**
 * 템플릿 기반 PPTX 빌드
 *
 * 디자이너가 만든 .pptx 템플릿에서 슬라이드를 복사하고
 * 플레이스홀더 텍스트를 실제 데이터로 치환합니다.
 */
export async function buildFromTemplate(
  opts: TemplateBuildOptions
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), "public", "templates", opts.templateFile);

  if (!fs.existsSync(templatePath)) {
    throw new Error(`템플릿 파일을 찾을 수 없습니다: ${templatePath}`);
  }

  const automizer = new Automizer({
    templateDir: path.join(process.cwd(), "public", "templates"),
    outputDir: path.join(process.cwd(), ".next", "cache"),
    removeExistingSlides: true,
  });

  // loadRoot = 출력의 기반 템플릿
  // load = 슬라이드를 복사해올 소스 템플릿 (같은 파일이지만 별도 등록 필요)
  const sourceName = "source";
  automizer
    .loadRoot(opts.templateFile)
    .load(opts.templateFile, sourceName);

  // 각 슬라이드를 템플릿에서 복사
  for (const slide of opts.slides) {
    const templateSlideIndex = SLIDE_TYPE_MAP[slide.slide_type] || 2; // 기본: 2번 슬라이드 (일반)

    automizer.addSlide(sourceName, templateSlideIndex, (slideMod) => {
      const slideType = slide.slide_type;

      // Title 치환 (cover, content 슬라이드에 존재)
      if (hasElement(slideType, "Title")) {
        slideMod.modifyElement("Title", [
          ModifyTextHelper.setText(slide.title),
        ]);
      }

      // Headline 치환
      if (slide.content.headline && hasElement(slideType, "Headline")) {
        slideMod.modifyElement("Headline", [
          ModifyTextHelper.setText(slide.content.headline),
        ]);
      }

      // Subtext 치환
      if (slide.content.subtext && hasElement(slideType, "Subtext")) {
        slideMod.modifyElement("Subtext", [
          ModifyTextHelper.setText(slide.content.subtext),
        ]);
      }

      // Bullets 치환 (content 슬라이드에만 존재, cover/thanks에는 없음)
      if (slide.content.bullets && slide.content.bullets.length > 0 && hasElement(slideType, "Bullets")) {
        const bulletText = slide.content.bullets.map(b => `• ${b}`).join("\n");
        slideMod.modifyElement("Bullets", [
          ModifyTextHelper.setText(bulletText),
        ]);
      }

      // CompanyName 치환
      if (hasElement(slideType, "CompanyName")) {
        slideMod.modifyElement("CompanyName", [
          ModifyTextHelper.setText(opts.companyName),
        ]);
      }
    });
  }

  // 감사 슬라이드 (마지막 슬라이드) — CompanyName, Subtext만 존재
  const lastSlideIndex = 13;
  automizer.addSlide(sourceName, lastSlideIndex, (slideMod) => {
    slideMod.modifyElement("CompanyName", [
      ModifyTextHelper.setText(opts.companyName),
    ]);
  });

  // 동시 요청 충돌 방지를 위해 UUID 기반 임시 파일명 사용
  const tempFileName = `ir-${crypto.randomUUID()}.pptx`;
  await automizer.write(tempFileName);

  // 파일을 읽어서 Buffer로 반환
  const outputPath = path.join(process.cwd(), ".next", "cache", tempFileName);
  const buffer = fs.readFileSync(outputPath);

  // 임시 파일 삭제
  try { fs.unlinkSync(outputPath); } catch {}

  return buffer;
}
