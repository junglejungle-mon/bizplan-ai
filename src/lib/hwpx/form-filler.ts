/**
 * 양식폼에 내용 삽입 (XML 조작)
 *
 * 매핑 결과를 기반으로 양식 XML에 텍스트를 삽입.
 * 원본 양식의 서식/레이아웃은 유지하면서 빈 영역에만 내용을 채움.
 *
 * 기존 template-filler.ts의 escapeXml, 멀티라인 <hp:p> 확장 로직을 재활용.
 */

import JSZip from "jszip";
import type { ParsedForm, FormField } from "./types";

// ===== 공통 유틸리티 (template-filler.ts에서 추출) =====

export function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ===== XML 삽입 =====

/**
 * paraIndex 기반으로 XML 내 해당 <hp:p> 블록을 찾아 텍스트 삽입
 */
function insertTextAtParagraph(
  xml: string,
  paraIndex: number,
  content: string,
  field: FormField
): string {
  // 모든 <hp:p> 블록의 위치를 찾기
  const paraPositions: Array<{ start: number; end: number; full: string }> = [];
  const paraRegex = /<hp:p[^>]*>[\s\S]*?<\/hp:p>/g;
  let match;

  while ((match = paraRegex.exec(xml)) !== null) {
    paraPositions.push({
      start: match.index,
      end: match.index + match[0].length,
      full: match[0],
    });
  }

  // 해당 paraIndex의 블록 찾기
  if (paraIndex >= paraPositions.length) {
    console.warn(
      `[form-filler] paraIndex ${paraIndex} 범위 초과 (총 ${paraPositions.length}개)`
    );
    return xml;
  }

  const targetPara = paraPositions[paraIndex];
  const lines = content.split("\n").filter((l) => l.trim());

  if (lines.length === 0) return xml;

  // 단일 줄: <hp:t> 태그 내용만 교체
  if (lines.length === 1) {
    const replaced = replaceEmptyTextInParagraph(
      targetPara.full,
      escapeXml(lines[0])
    );
    return xml.substring(0, targetPara.start) + replaced + xml.substring(targetPara.end);
  }

  // 여러 줄: 원본 <hp:p> 블록을 여러 단락으로 확장
  const expandedParagraphs = expandToMultipleParagraphs(
    targetPara.full,
    lines
  );
  return (
    xml.substring(0, targetPara.start) +
    expandedParagraphs +
    xml.substring(targetPara.end)
  );
}

/**
 * 빈 <hp:t> 태그에 텍스트 삽입
 * <hp:t/> 또는 <hp:t></hp:t> → <hp:t>내용</hp:t>
 */
function replaceEmptyTextInParagraph(
  paraXml: string,
  escapedText: string
): string {
  // 빈 self-closing 태그
  if (paraXml.includes("<hp:t/>")) {
    return paraXml.replace("<hp:t/>", `<hp:t>${escapedText}</hp:t>`);
  }

  // 빈 텍스트 태그
  const emptyPattern = /<hp:t><\/hp:t>/;
  if (emptyPattern.test(paraXml)) {
    return paraXml.replace(emptyPattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 공백만 있는 텍스트 태그
  const whitespacePattern = /<hp:t>\s*<\/hp:t>/;
  if (whitespacePattern.test(paraXml)) {
    return paraXml.replace(whitespacePattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 이미 내용이 있는 경우 (덮어쓰기)
  const textPattern = /<hp:t>([\s\S]*?)<\/hp:t>/;
  const textMatch = paraXml.match(textPattern);
  if (textMatch && textMatch[1].trim().length === 0) {
    return paraXml.replace(textPattern, `<hp:t>${escapedText}</hp:t>`);
  }

  return paraXml;
}

/**
 * 하나의 <hp:p> 블록을 여러 줄에 맞게 확장
 * 첫 줄은 원본 스타일 유지, 나머지는 복제
 */
function expandToMultipleParagraphs(
  originalPara: string,
  lines: string[]
): string {
  const paragraphs: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const escapedLine = escapeXml(lines[i]);

    if (i === 0) {
      // 첫 줄: 원본 단락에 텍스트 삽입
      paragraphs.push(replaceEmptyTextInParagraph(originalPara, escapedLine));
    } else {
      // 나머지: 원본 단락 복제 + ID 변경 + 텍스트 교체
      let cloned = originalPara;

      // id 속성 업데이트 (중복 방지)
      cloned = cloned.replace(
        /(<hp:p[^>]*\s)id="[^"]*"/,
        `$1id="${Date.now() + i}"`
      );

      // 텍스트 삽입
      cloned = replaceEmptyTextInParagraph(cloned, escapedLine);

      // 혹시 빈 텍스트가 교체 안 됐으면 (이미 내용이 있던 경우)
      // 첫 번째 <hp:t> 내용을 직접 교체
      if (!cloned.includes(escapedLine)) {
        cloned = cloned.replace(
          /<hp:t>([\s\S]*?)<\/hp:t>/,
          `<hp:t>${escapedLine}</hp:t>`
        );
      }

      paragraphs.push(cloned);
    }
  }

  return paragraphs.join("\n");
}

// ===== 테이블 셀 삽입 =====

/**
 * 테이블 내 특정 셀에 텍스트 삽입
 * 테이블 구조에서 라벨 셀 옆의 빈 셀을 찾아 내용 삽입
 */
function insertIntoTableCell(
  xml: string,
  field: FormField,
  content: string
): string {
  // 테이블 셀의 paraIndex를 기반으로 삽입
  return insertTextAtParagraph(
    xml,
    parseInt(field.xpath.match(/\d+/)?.[0] || "0"),
    content,
    field
  );
}

// ===== 메인 채우기 함수 =====

/**
 * 파싱된 양식에 매핑된 내용을 삽입하여 새 HWPX 생성
 *
 * @param hwpxBuffer - 원본 양식 HWPX
 * @param parsedForm - 파싱된 양식 구조
 * @param fieldContents - 필드별 삽입할 내용 (fieldId → content)
 * @returns 채워진 HWPX Buffer + 통계
 */
export async function fillForm(
  hwpxBuffer: Buffer,
  parsedForm: ParsedForm,
  fieldContents: Record<string, string>
): Promise<{ buffer: Buffer; filledCount: number; skippedCount: number; warnings: string[] }> {
  const zip = await JSZip.loadAsync(hwpxBuffer);
  const warnings: string[] = [];
  let filledCount = 0;
  let skippedCount = 0;

  // sectionFile별로 필드 그룹화
  const fieldsBySection = new Map<string, FormField[]>();
  for (const field of parsedForm.fields) {
    const existing = fieldsBySection.get(field.sectionFile) || [];
    existing.push(field);
    fieldsBySection.set(field.sectionFile, existing);
  }

  // 각 section XML 처리
  for (const [sectionFile, fields] of fieldsBySection) {
    const zipFile = zip.file(sectionFile);
    if (!zipFile) {
      warnings.push(`section 파일을 찾을 수 없음: ${sectionFile}`);
      continue;
    }

    let xml = await zipFile.async("string");

    // paraIndex가 큰 것부터 처리 (앞쪽 수정이 뒤쪽 인덱스에 영향 안 주도록)
    const sortedFields = [...fields].sort((a, b) => {
      const aIdx = parseInt(a.xpath.match(/\d+/)?.[0] || "0");
      const bIdx = parseInt(b.xpath.match(/\d+/)?.[0] || "0");
      return bIdx - aIdx;
    });

    for (const field of sortedFields) {
      const content = fieldContents[field.id];

      if (!content) {
        skippedCount++;
        continue;
      }

      const paraIndex = parseInt(field.xpath.match(/\d+/)?.[0] || "0");

      try {
        if (field.isInTable) {
          xml = insertIntoTableCell(xml, field, content);
        } else {
          xml = insertTextAtParagraph(xml, paraIndex, content, field);
        }
        filledCount++;
      } catch (error) {
        warnings.push(
          `필드 "${field.label}" 삽입 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
        skippedCount++;
      }
    }

    zip.file(sectionFile, xml);
  }

  // 새 HWPX ZIP 생성
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { buffer, filledCount, skippedCount, warnings };
}
