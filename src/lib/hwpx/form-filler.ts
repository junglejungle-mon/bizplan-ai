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
 * 깊이 카운팅 방식으로 <hp:p> 블록 경계를 정확히 찾기
 * 중첩된 <hp:p> (테이블 셀 내부 등)에서도 올바르게 동작
 */
function findParagraphPositions(
  xml: string
): Array<{ start: number; end: number; full: string }> {
  const positions: Array<{ start: number; end: number; full: string }> = [];
  const openTag = /<hp:p[\s>]/g;

  let openMatch;
  while ((openMatch = openTag.exec(xml)) !== null) {
    const startPos = openMatch.index;
    let depth = 1;
    let searchPos = openMatch.index + openMatch[0].length;

    // 셀프클로징 태그 체크: <hp:p ... />
    const selfClosingCheck = xml.substring(startPos, startPos + 500);
    const selfClosingMatch = selfClosingCheck.match(/^<hp:p[^>]*\/>/);
    if (selfClosingMatch) {
      positions.push({
        start: startPos,
        end: startPos + selfClosingMatch[0].length,
        full: selfClosingMatch[0],
      });
      continue;
    }

    // 깊이 카운팅으로 매칭되는 닫기 태그 찾기
    while (depth > 0 && searchPos < xml.length) {
      const nextOpen = xml.indexOf("<hp:p", searchPos);
      const nextClose = xml.indexOf("</hp:p>", searchPos);

      if (nextClose === -1) break; // 닫기 태그 없으면 중단

      if (nextOpen !== -1 && nextOpen < nextClose) {
        // 중첩 열기 태그 발견 — 셀프클로징이 아닌 경우만 depth++
        const afterOpen = xml.substring(nextOpen, nextOpen + 500);
        if (/^<hp:p[^>]*\/>/.test(afterOpen)) {
          // 셀프클로징은 depth 변화 없이 넘어감
          searchPos = nextOpen + afterOpen.match(/^<hp:p[^>]*\/>/)![0].length;
        } else {
          depth++;
          searchPos = nextOpen + 5; // "<hp:p".length
        }
      } else {
        // 닫기 태그 발견
        depth--;
        if (depth === 0) {
          const endPos = nextClose + "</hp:p>".length;
          positions.push({
            start: startPos,
            end: endPos,
            full: xml.substring(startPos, endPos),
          });
        }
        searchPos = nextClose + "</hp:p>".length;
      }
    }
  }

  return positions;
}

/**
 * XML well-formedness 간이 검증
 * 삽입 후 기본적인 태그 균형이 맞는지 확인
 */
function validateXmlBalance(xml: string): { valid: boolean; error?: string } {
  // <hp:p> 열기/닫기 수 일치 확인
  const openCount = (xml.match(/<hp:p[\s>]/g) || []).length;
  const selfClosingCount = (xml.match(/<hp:p[^>]*\/>/g) || []).length;
  const closeCount = (xml.match(/<\/hp:p>/g) || []).length;

  const expectedCloseCount = openCount - selfClosingCount;
  if (expectedCloseCount !== closeCount) {
    return {
      valid: false,
      error: `<hp:p> 태그 불균형: 열기 ${openCount}개(셀프클로징 ${selfClosingCount}개), 닫기 ${closeCount}개`,
    };
  }

  // <hp:run> 열기/닫기 수 일치 확인
  const runOpenCount = (xml.match(/<hp:run[\s>]/g) || []).length;
  const runSelfClosingCount = (xml.match(/<hp:run[^>]*\/>/g) || []).length;
  const runCloseCount = (xml.match(/<\/hp:run>/g) || []).length;

  const expectedRunClose = runOpenCount - runSelfClosingCount;
  if (expectedRunClose !== runCloseCount) {
    return {
      valid: false,
      error: `<hp:run> 태그 불균형: 열기 ${runOpenCount}개, 닫기 ${runCloseCount}개`,
    };
  }

  return { valid: true };
}

/**
 * paraIndex 기반으로 XML 내 해당 <hp:p> 블록을 찾아 텍스트 삽입
 */
function insertTextAtParagraph(
  xml: string,
  paraIndex: number,
  content: string,
  field: FormField
): string {
  // 깊이 카운팅으로 정확한 <hp:p> 블록 위치 찾기
  const paraPositions = findParagraphPositions(xml);

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

  let result: string;

  // 단일 줄: <hp:t> 태그 내용만 교체
  if (lines.length === 1) {
    const replaced = replaceEmptyTextInParagraph(
      targetPara.full,
      escapeXml(lines[0])
    );
    result = xml.substring(0, targetPara.start) + replaced + xml.substring(targetPara.end);
  } else {
    // 여러 줄: 원본 <hp:p> 블록을 여러 단락으로 확장
    const expandedParagraphs = expandToMultipleParagraphs(
      targetPara.full,
      lines
    );
    result =
      xml.substring(0, targetPara.start) +
      expandedParagraphs +
      xml.substring(targetPara.end);
  }

  // 삽입 후 XML 태그 균형 검증
  const validation = validateXmlBalance(result);
  if (!validation.valid) {
    console.warn(
      `[form-filler] XML 검증 실패 (필드: "${field.label}"): ${validation.error}. 원본 유지.`
    );
    return xml; // 원본 반환 (안전)
  }

  return result;
}

/**
 * 빈 <hp:t> 태그에 텍스트 삽입
 * 다양한 빈 칸 패턴을 포괄적으로 처리:
 * - <hp:t/>, <hp:t></hp:t>, <hp:t>  </hp:t>
 * - <hp:run><hp:t/></hp:run> (빈 run 블록)
 * - <hp:run> ... <hp:t></hp:t></hp:run> (스타일만 있는 run 블록)
 * - 플레이스홀더 텍스트 ("입력하세요" 등)
 */
function replaceEmptyTextInParagraph(
  paraXml: string,
  escapedText: string
): string {
  // 1. 빈 self-closing <hp:t/>
  if (paraXml.includes("<hp:t/>")) {
    return paraXml.replace("<hp:t/>", `<hp:t>${escapedText}</hp:t>`);
  }

  // 2. 빈 텍스트 태그 <hp:t></hp:t>
  const emptyPattern = /<hp:t><\/hp:t>/;
  if (emptyPattern.test(paraXml)) {
    return paraXml.replace(emptyPattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 3. 공백/특수공백만 있는 텍스트 태그
  const whitespacePattern = /<hp:t>[\s\u00A0\u3000]*<\/hp:t>/;
  if (whitespacePattern.test(paraXml)) {
    return paraXml.replace(whitespacePattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 4. 밑줄/대시 패턴 (빈칸 표시) — "____", "ㅡㅡㅡ", "------"
  const underlinePattern = /<hp:t>[_ㅡ\-]{3,}<\/hp:t>/;
  if (underlinePattern.test(paraXml)) {
    return paraXml.replace(underlinePattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 5. 플레이스홀더 텍스트 ("입력하세요", "작성하세요" 등)
  const placeholderPattern = /<hp:t>[\s]*(입력|작성|기재|기입)[\s]*(하세요|해\s*주세요|바랍니다|해\s*주십시오|요망)[^<]*<\/hp:t>/;
  if (placeholderPattern.test(paraXml)) {
    return paraXml.replace(placeholderPattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 6. 예시 텍스트 ("예) ", "ex) ")
  const examplePattern = /<hp:t>[\s]*(예\)|ex\))[^<]*<\/hp:t>/i;
  if (examplePattern.test(paraXml)) {
    return paraXml.replace(examplePattern, `<hp:t>${escapedText}</hp:t>`);
  }

  // 7. <hp:run>에 <hp:t>가 없는 경우 — run의 닫기 태그 앞에 <hp:t> 삽입
  const runWithoutText = /<hp:run([^>]*)>((?:(?!<hp:t)[\s\S])*?)<\/hp:run>/;
  const runMatch = paraXml.match(runWithoutText);
  if (runMatch) {
    const newRun = `<hp:run${runMatch[1]}>${runMatch[2]}<hp:t>${escapedText}</hp:t></hp:run>`;
    return paraXml.replace(runWithoutText, newRun);
  }

  // 8. 이미 내용이 있지만 실질적으로 빈 경우 (공백 + 특수문자만)
  const nearEmptyPattern = /<hp:t>([\s\u00A0\u3000·•○□]*)<\/hp:t>/;
  const nearEmptyMatch = paraXml.match(nearEmptyPattern);
  if (nearEmptyMatch && nearEmptyMatch[1].trim().length === 0) {
    return paraXml.replace(nearEmptyPattern, `<hp:t>${escapedText}</hp:t>`);
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
        const xmlBefore = xml;

        if (field.isInTable) {
          xml = insertIntoTableCell(xml, field, content);
        } else {
          xml = insertTextAtParagraph(xml, paraIndex, content, field);
        }

        // 삽입 검증: XML이 실제로 변경되었는지 확인
        if (xml === xmlBefore) {
          warnings.push(
            `필드 "${field.label}" 삽입 안 됨 (빈 칸을 찾지 못함)`
          );
          skippedCount++;
        } else {
          filledCount++;
        }
      } catch (error) {
        warnings.push(
          `필드 "${field.label}" 삽입 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`
        );
        skippedCount++;
      }
    }

    zip.file(sectionFile, xml);
  }

  // 채우기 결과 요약 경고
  if (filledCount === 0 && parsedForm.fields.length > 0) {
    warnings.push(
      `경고: ${parsedForm.fields.length}개 필드 중 하나도 채워지지 않았습니다. 양식 구조가 예상과 다를 수 있습니다.`
    );
  } else if (skippedCount > filledCount) {
    warnings.push(
      `주의: 채운 필드(${filledCount}개)보다 스킵된 필드(${skippedCount}개)가 더 많습니다.`
    );
  }

  // 새 HWPX ZIP 생성
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { buffer, filledCount, skippedCount, warnings };
}
