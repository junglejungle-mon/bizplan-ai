/**
 * HWPX 템플릿 필러
 * 공고 양식폼(HWPX)을 읽어서 {{placeholder}}를 사업계획서 내용으로 채움
 *
 * 흐름:
 *   1. HWPX(ZIP) 열기 → section*.xml 추출
 *   2. {{placeholder}} 패턴 파싱 → 필드 목록 반환
 *   3. AI가 사업계획서 내용을 필드에 매핑
 *   4. placeholder를 실제 내용으로 교체 → 새 HWPX 생성
 */

import JSZip from "jszip";

// ===== 타입 정의 =====

export interface TemplateField {
  /** placeholder 원본 (예: "{{창업아이템명}}") */
  placeholder: string;
  /** placeholder 키 (예: "창업아이템명") */
  key: string;
  /** 바로 위 섹션/소제목 텍스트 (컨텍스트) */
  context: string;
  /** section XML 파일명 (예: "Contents/section0.xml") */
  sectionFile: string;
}

export interface ParsedTemplate {
  /** 양식에서 발견된 모든 필드 */
  fields: TemplateField[];
  /** 양식 제목 (첫 번째 텍스트) */
  title: string;
  /** 섹션 구조 (대제목 → 소제목 → 필드) */
  structure: TemplateSection[];
}

export interface TemplateSection {
  title: string;
  subsections: Array<{
    title: string;
    fieldKey: string | null;
  }>;
}

export interface FillData {
  [key: string]: string;
}

// ===== HWPX 템플릿 파서 =====

/**
 * HWPX 파일에서 {{placeholder}} 필드를 추출
 */
export async function parseHwpxTemplate(
  hwpxBuffer: Buffer
): Promise<ParsedTemplate> {
  const zip = await JSZip.loadAsync(hwpxBuffer);

  const fields: TemplateField[] = [];
  let title = "";
  const structure: TemplateSection[] = [];

  // section*.xml 파일 찾기
  const sectionFiles = Object.keys(zip.files).filter(
    (name) => name.match(/Contents\/section\d+\.xml$/)
  );

  for (const sectionFile of sectionFiles) {
    const xml = await zip.file(sectionFile)!.async("string");
    const result = parseSectionXml(xml, sectionFile);

    fields.push(...result.fields);
    structure.push(...result.sections);
    if (!title && result.title) {
      title = result.title;
    }
  }

  return { fields, title, structure };
}

/**
 * section XML에서 텍스트와 {{placeholder}} 추출
 */
function parseSectionXml(
  xml: string,
  sectionFile: string
): {
  fields: TemplateField[];
  title: string;
  sections: TemplateSection[];
} {
  const fields: TemplateField[] = [];
  const sections: TemplateSection[] = [];
  let title = "";

  // <hp:t>...</hp:t> 태그에서 텍스트 추출
  const textPattern = /<hp:t>(.*?)<\/hp:t>/g;
  const texts: string[] = [];
  let match;

  while ((match = textPattern.exec(xml)) !== null) {
    const text = match[1].trim();
    if (text) texts.push(text);
  }

  // 첫 번째 텍스트 = 제목
  if (texts.length > 0) {
    title = texts[0];
  }

  // 구조 파악: 섹션 제목, 소제목, placeholder 추적
  let currentSection: TemplateSection | null = null;
  let lastContext = "";

  for (const text of texts) {
    // {{placeholder}} 패턴 감지
    const placeholderMatch = text.match(/\{\{(.+?)\}\}/);
    if (placeholderMatch) {
      fields.push({
        placeholder: placeholderMatch[0],
        key: placeholderMatch[1],
        context: lastContext,
        sectionFile,
      });
      if (currentSection && currentSection.subsections.length > 0) {
        const lastSub = currentSection.subsections[currentSection.subsections.length - 1];
        if (!lastSub.fieldKey) {
          lastSub.fieldKey = placeholderMatch[1];
        }
      }
      continue;
    }

    // 대제목 패턴 (숫자. 제목)
    if (/^\d+\.\s/.test(text) && !/^\d+-\d+/.test(text)) {
      currentSection = { title: text, subsections: [] };
      sections.push(currentSection);
      lastContext = text;
      continue;
    }

    // 소제목 패턴 (숫자-숫자. 제목)
    if (/^\d+-\d+/.test(text) && currentSection) {
      currentSection.subsections.push({ title: text, fieldKey: null });
      lastContext = text;
      continue;
    }

    // 일반 텍스트 → 컨텍스트 업데이트
    if (text.length > 2) {
      lastContext = text;
    }
  }

  return { fields, title, sections };
}

// ===== HWPX 템플릿 필러 =====

/**
 * HWPX 양식의 {{placeholder}}를 실제 내용으로 교체
 * 원본 양식의 서식/레이아웃은 유지하면서 텍스트만 교체
 */
export async function fillHwpxTemplate(
  hwpxBuffer: Buffer,
  fillData: FillData
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(hwpxBuffer);

  // section*.xml 파일 처리
  const sectionFiles = Object.keys(zip.files).filter(
    (name) => name.match(/Contents\/section\d+\.xml$/)
  );

  for (const sectionFile of sectionFiles) {
    const xml = await zip.file(sectionFile)!.async("string");
    const filledXml = replacePlaceholders(xml, fillData);
    zip.file(sectionFile, filledXml);
  }

  // 새 HWPX 생성
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}

/**
 * XML 내 {{placeholder}}를 실제 텍스트로 교체
 * 여러 줄 내용은 여러 <hp:p> 단락으로 분할
 */
function replacePlaceholders(xml: string, fillData: FillData): string {
  let result = xml;

  for (const [key, value] of Object.entries(fillData)) {
    const placeholder = `{{${key}}}`;
    if (!result.includes(placeholder)) continue;

    // 단일 줄이면 단순 교체
    const lines = value.split("\n").filter((l) => l.trim());
    if (lines.length <= 1) {
      result = result.replace(placeholder, escapeXml(value.trim()));
      continue;
    }

    // 여러 줄: placeholder가 들어있는 <hp:p> 블록을 찾아서 여러 단락으로 확장
    const pBlockRegex = new RegExp(
      `(<hp:p[^>]*>\\s*<hp:run[^>]*>)\\s*<hp:t>\\s*\\{\\{${escapeRegex(key)}\\}\\}\\s*<\\/hp:t>\\s*(<\\/hp:run>\\s*<hp:linesegarray>.*?<\\/hp:linesegarray>\\s*<\\/hp:p>)`,
      "s"
    );

    const pMatch = result.match(pBlockRegex);
    if (pMatch) {
      const [fullMatch, pStart, pEnd] = pMatch;
      // 첫 줄은 원본 단락에, 나머지는 새 단락으로
      const paragraphs = lines.map((line, i) => {
        if (i === 0) {
          return `${pStart}<hp:t>${escapeXml(line)}</hp:t>${pEnd}`;
        }
        // 같은 스타일의 새 단락 생성 (charPrIDRef, paraPrIDRef 유지)
        return `${pStart.replace(/id="[^"]*"/, `id="${Date.now() + i}"`)}<hp:t>${escapeXml(line)}</hp:t>${pEnd}`;
      });
      result = result.replace(fullMatch, paragraphs.join("\n"));
    } else {
      // 정규식 매칭 실패 시 단순 교체
      result = result.replace(placeholder, escapeXml(lines.join("\n")));
    }
  }

  return result;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
