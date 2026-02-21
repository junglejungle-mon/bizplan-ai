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
      // 텍스트 플레이스홀더 치환 (안전하게 — 없는 요소는 무시)
      safeModify(slideMod, "Title", [
        ModifyTextHelper.setText(slide.title),
      ]);

      if (slide.content.headline) {
        safeModify(slideMod, "Headline", [
          ModifyTextHelper.setText(slide.content.headline),
        ]);
      }

      if (slide.content.subtext) {
        safeModify(slideMod, "Subtext", [
          ModifyTextHelper.setText(slide.content.subtext),
        ]);
      }

      // 불릿 포인트는 줄바꿈으로 연결
      if (slide.content.bullets && slide.content.bullets.length > 0) {
        const bulletText = slide.content.bullets.map(b => `• ${b}`).join("\n");
        safeModify(slideMod, "Bullets", [
          ModifyTextHelper.setText(bulletText),
        ]);
      }

      // 회사명 치환
      safeModify(slideMod, "CompanyName", [
        ModifyTextHelper.setText(opts.companyName),
      ]);
    });
  }

  // 감사 슬라이드 (마지막 슬라이드)
  const lastSlideIndex = 13; // 감사 슬라이드
  automizer.addSlide(sourceName, lastSlideIndex, (slideMod) => {
    safeModify(slideMod, "CompanyName", [
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
