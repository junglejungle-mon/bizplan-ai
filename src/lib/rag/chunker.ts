/**
 * 문서 청킹 모듈
 * 섹션 헤더 기반 분할 + 1500자 초과 시 문단 분할 (200자 오버랩)
 */

export interface Chunk {
  content: string;
  sectionName: string;
  chunkIndex: number;
}

const SECTION_HEADER_REGEX =
  /^(?:#{1,4}\s+.+|(?:\d+[-.])+\s*.+|[가-힣][.]\s*.+|\(\d+\)\s*.+)/m;

const MIN_CHUNK_SIZE = 500;
const MAX_CHUNK_SIZE = 1500;
const OVERLAP_SIZE = 200;

/**
 * OCR 텍스트를 섹션 기반으로 청킹
 */
export function chunkDocument(text: string): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIndex = 0;

  // 섹션 헤더로 1차 분할
  const sections = splitBySections(text);

  for (const section of sections) {
    if (section.content.trim().length < 50) continue;

    if (section.content.length <= MAX_CHUNK_SIZE) {
      chunks.push({
        content: section.content.trim(),
        sectionName: section.name,
        chunkIndex: chunkIndex++,
      });
    } else {
      // 1500자 초과: 문단 분할 + 오버랩
      const subChunks = splitByParagraphs(section.content, section.name);
      for (const sub of subChunks) {
        chunks.push({
          content: sub.trim(),
          sectionName: section.name,
          chunkIndex: chunkIndex++,
        });
      }
    }
  }

  return chunks;
}

interface Section {
  name: string;
  content: string;
}

function splitBySections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentName = "서두";
  let currentContent = "";

  for (const line of lines) {
    if (SECTION_HEADER_REGEX.test(line.trim()) && currentContent.length > 0) {
      sections.push({ name: currentName, content: currentContent });
      currentName = line.trim().replace(/^#+\s*/, "").replace(/^\d+[-.]?\s*/, "").trim() || "미분류";
      currentContent = line + "\n";
    } else {
      currentContent += line + "\n";
    }
  }

  if (currentContent.trim()) {
    sections.push({ name: currentName, content: currentContent });
  }

  return sections;
}

function splitByParagraphs(text: string, _sectionName: string): string[] {
  const paragraphs = text.split(/\n\s*\n/);
  const result: string[] = [];
  let current = "";

  for (const para of paragraphs) {
    if ((current + para).length > MAX_CHUNK_SIZE && current.length >= MIN_CHUNK_SIZE) {
      result.push(current);
      // 오버랩: 이전 청크 끝 200자 유지
      const overlap = current.slice(-OVERLAP_SIZE);
      current = overlap + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }

  if (current.trim().length >= 50) {
    result.push(current);
  }

  return result;
}
