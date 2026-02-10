/**
 * 실제 정부 양식폼 구조 파싱 (AI 기반)
 *
 * {{placeholder}} 없이도 동작하는 범용 파서.
 * 전략:
 *   1. HWPX ZIP → section*.xml 추출
 *   2. <hp:t> 텍스트 전체 추출 + 위치(순서) 기록
 *   3. 빈 텍스트 영역 탐지 (<hp:t></hp:t> 또는 공백만 있는 영역)
 *   4. 라벨-필드 패턴 인식 ("사업명:" 다음 빈 영역 = 필드)
 *   5. 테이블 구조 파싱 (<hp:tbl> 내 셀에서 라벨과 빈 셀 매칭)
 *   6. 섹션 구조 추출 (번호 패턴 기반)
 *   7. (복잡한 양식) Claude AI 보조 파싱
 */

import JSZip from "jszip";
import { callClaude } from "@/lib/ai/claude";
import type { FormField, FormSection, ParsedForm } from "./types";

// ===== 텍스트 노드 정보 =====

interface TextNode {
  /** 텍스트 내용 */
  text: string;
  /** paragraph index (XML 내 순서) */
  paraIndex: number;
  /** section 파일명 */
  sectionFile: string;
  /** 테이블 안에 있는지 */
  isInTable: boolean;
  /** 텍스트가 비어있는지 */
  isEmpty: boolean;
  /** XML 내 대략적인 위치 (문자 오프셋) */
  xmlOffset: number;
}

// ===== 섹션 번호 패턴 =====

/** 대제목: "1.", "2.", "Ⅰ.", "가." 등 */
const SECTION_TITLE_PATTERN = /^(?:\d+\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.|[가나다라마바사아자차카타파하]\.)\s*/;

/** 소제목: "1-1.", "1.1.", "(1)", "가)", "①" 등 */
const SUBSECTION_PATTERN = /^(?:\d+-\d+\.|\d+\.\d+\.|\(\d+\)|[가나다라마바사아자차카타파하]\)|[①②③④⑤⑥⑦⑧⑨⑩])\s*/;

/** 라벨 패턴: "사업명:", "대표자명 :", "회사명" 등 (뒤에 콜론이나 공백) */
const LABEL_PATTERN = /^[가-힣a-zA-Z\s]{2,20}[:：]\s*$/;

// ===== XML 파싱 =====

/**
 * section XML에서 모든 텍스트 노드 추출
 * <hp:t> 태그 내용과 위치 정보를 함께 반환
 */
function extractTextNodes(xml: string, sectionFile: string): TextNode[] {
  const nodes: TextNode[] = [];
  let paraIndex = 0;

  // 각 <hp:p> 단락 처리
  const paraPattern = /<hp:p[^>]*>([\s\S]*?)<\/hp:p>/g;
  let paraMatch;

  while ((paraMatch = paraPattern.exec(xml)) !== null) {
    const paraContent = paraMatch[1];
    const isInTable = isInsideTable(xml, paraMatch.index);

    // <hp:t> 태그 추출
    const textPattern = /<hp:t>([\s\S]*?)<\/hp:t>|<hp:t\/>/g;
    let textMatch;
    let hasText = false;

    while ((textMatch = textPattern.exec(paraContent)) !== null) {
      hasText = true;
      const rawText = textMatch[1] ?? "";
      const text = rawText.trim();

      nodes.push({
        text,
        paraIndex,
        sectionFile,
        isInTable,
        isEmpty: text.length === 0,
        xmlOffset: paraMatch.index + textMatch.index,
      });
    }

    // <hp:t> 태그가 아예 없는 빈 단락
    if (!hasText) {
      nodes.push({
        text: "",
        paraIndex,
        sectionFile,
        isInTable,
        isEmpty: true,
        xmlOffset: paraMatch.index,
      });
    }

    paraIndex++;
  }

  return nodes;
}

/** 주어진 offset이 <hp:tbl>...</hp:tbl> 안에 있는지 확인 */
function isInsideTable(xml: string, offset: number): boolean {
  const beforeText = xml.substring(0, offset);
  const lastTblOpen = beforeText.lastIndexOf("<hp:tbl");
  const lastTblClose = beforeText.lastIndexOf("</hp:tbl>");

  if (lastTblOpen === -1) return false;
  return lastTblOpen > lastTblClose;
}

// ===== 필드 탐지 =====

/**
 * 텍스트 노드 배열에서 작성 대상 필드를 탐지
 * 라벨-빈칸 패턴, 섹션 구조, 테이블 구조를 분석
 */
function detectFields(nodes: TextNode[]): FormField[] {
  const fields: FormField[] = [];
  let fieldCounter = 0;
  let currentSectionTitle = "";
  let currentSubsectionTitle = "";
  let lastLabelText = "";

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const { text } = node;

    // 섹션 제목 추적
    if (SECTION_TITLE_PATTERN.test(text)) {
      currentSectionTitle = text;
      continue;
    }
    if (SUBSECTION_PATTERN.test(text)) {
      currentSubsectionTitle = text;
      continue;
    }

    // 패턴 1: 라벨 뒤에 빈 칸 ("사업명:" → 빈칸)
    if (LABEL_PATTERN.test(text)) {
      lastLabelText = text.replace(/[:：]\s*$/, "").trim();
      // 다음 노드가 비어있으면 필드
      const nextNode = nodes[i + 1];
      if (nextNode && nextNode.isEmpty) {
        fields.push(
          makeField(
            fieldCounter++,
            lastLabelText,
            nextNode,
            currentSectionTitle,
            currentSubsectionTitle,
            text
          )
        );
        i++; // 빈 노드 스킵
      }
      continue;
    }

    // 패턴 2: 콜론으로 끝나는 텍스트 뒤의 빈칸
    if (text.endsWith(":") || text.endsWith("：")) {
      lastLabelText = text.replace(/[:：]\s*$/, "").trim();
      const nextNode = nodes[i + 1];
      if (nextNode && nextNode.isEmpty) {
        fields.push(
          makeField(
            fieldCounter++,
            lastLabelText,
            nextNode,
            currentSectionTitle,
            currentSubsectionTitle,
            text
          )
        );
        i++;
      }
      continue;
    }

    // 패턴 3: 소제목 바로 아래 빈 영역 = 서술형 작성 필드
    if (
      currentSubsectionTitle &&
      node.isEmpty &&
      isConsecutiveEmpty(nodes, i, 2)
    ) {
      fields.push(
        makeField(
          fieldCounter++,
          currentSubsectionTitle.replace(SUBSECTION_PATTERN, "").trim(),
          node,
          currentSectionTitle,
          currentSubsectionTitle,
          currentSubsectionTitle,
          "textarea"
        )
      );
      // 연속된 빈 노드는 하나의 필드로 처리
      while (i + 1 < nodes.length && nodes[i + 1].isEmpty) i++;
      continue;
    }

    // 패턴 4: 테이블 내 빈 셀 (라벨 셀 옆의 빈 셀)
    if (node.isInTable && node.isEmpty) {
      // 같은 테이블 내 직전 텍스트가 라벨인지 확인
      const prevTableNode = findPrevTableNode(nodes, i);
      if (prevTableNode && prevTableNode.text.length >= 2) {
        fields.push(
          makeField(
            fieldCounter++,
            prevTableNode.text.replace(/[:：]\s*$/, "").trim(),
            node,
            currentSectionTitle,
            currentSubsectionTitle,
            prevTableNode.text,
            "table_cell"
          )
        );
      }
      continue;
    }

    // 일반 텍스트: 컨텍스트 업데이트
    if (text.length > 2) {
      lastLabelText = text;
    }
  }

  return fields;
}

/** 연속된 빈 노드가 n개 이상인지 확인 */
function isConsecutiveEmpty(
  nodes: TextNode[],
  startIdx: number,
  minCount: number
): boolean {
  let count = 0;
  for (let i = startIdx; i < nodes.length && nodes[i].isEmpty; i++) {
    count++;
    if (count >= minCount) return true;
  }
  return count >= minCount;
}

/** 같은 테이블 내 직전 비어있지 않은 노드 찾기 */
function findPrevTableNode(
  nodes: TextNode[],
  currentIdx: number
): TextNode | null {
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (!nodes[i].isInTable) return null; // 테이블 벗어남
    if (!nodes[i].isEmpty) return nodes[i];
  }
  return null;
}

/** FormField 생성 헬퍼 */
function makeField(
  counter: number,
  label: string,
  node: TextNode,
  sectionTitle: string,
  subsectionTitle: string,
  precedingText: string,
  type: "text" | "textarea" | "table_cell" = "text"
): FormField {
  return {
    id: `field_${node.sectionFile.replace(/\D/g, "")}_${counter}`,
    label,
    type,
    xpath: `p[${node.paraIndex}]`,
    sectionFile: node.sectionFile,
    context: {
      sectionTitle,
      subsectionTitle,
      precedingText,
    },
    isInTable: node.isInTable,
    isEmpty: true,
  };
}

// ===== 섹션 구조 추출 =====

function extractStructure(
  nodes: TextNode[],
  fields: FormField[]
): FormSection[] {
  const sections: FormSection[] = [];
  let currentSection: FormSection | null = null;

  // 필드 ID를 paraIndex로 빠르게 조회
  const fieldByPara = new Map<number, FormField>();
  for (const f of fields) {
    const paraIdx = parseInt(f.xpath.match(/\d+/)?.[0] || "0");
    fieldByPara.set(paraIdx, f);
  }

  for (const node of nodes) {
    if (SECTION_TITLE_PATTERN.test(node.text)) {
      currentSection = {
        title: node.text,
        level: 1,
        subsections: [],
      };
      sections.push(currentSection);
      continue;
    }

    if (SUBSECTION_PATTERN.test(node.text) && currentSection) {
      currentSection.subsections.push({
        title: node.text,
        fields: [],
      });
      continue;
    }

    // 필드가 있으면 현재 소제목에 연결
    const field = fieldByPara.get(node.paraIndex);
    if (field && currentSection && currentSection.subsections.length > 0) {
      const lastSub =
        currentSection.subsections[currentSection.subsections.length - 1];
      lastSub.fields.push(field.id);
    }
  }

  return sections;
}

// ===== 복잡도 판정 =====

function assessComplexity(
  fields: FormField[]
): "simple" | "medium" | "complex" {
  if (fields.length <= 5) return "simple";
  if (fields.length <= 15) return "medium";
  return "complex";
}

// ===== AI 보조 파싱 (복잡한 양식용) =====

/**
 * Claude에게 XML 텍스트를 전달하여 필드 구조를 추출
 * 규칙 기반 파서가 충분한 필드를 찾지 못했을 때 사용
 */
async function aiAssistedParse(
  xmlTexts: Record<string, string[]>,
  existingFields: FormField[]
): Promise<FormField[]> {
  // 각 section의 텍스트를 요약하여 전달
  const textSummary = Object.entries(xmlTexts)
    .map(
      ([file, texts]) =>
        `[${file}]\n${texts.map((t, i) => `${i}: ${t || "(빈칸)"}`).join("\n")}`
    )
    .join("\n\n");

  const prompt = `이 한국 정부지원사업 양식폼에서 작성해야 할 필드를 분석해주세요.

아래는 양식의 텍스트 내용입니다 (번호는 순서, "(빈칸)"은 비어있는 영역):

${textSummary}

이미 발견된 필드: ${existingFields.map((f) => f.label).join(", ") || "없음"}

위 양식에서 추가로 발견되는 작성 대상 필드를 JSON 배열로 반환해주세요.
각 필드는 다음 형태입니다:
[{"label": "필드명", "type": "text|textarea|table_cell", "paraIndex": 숫자, "sectionFile": "파일명"}]

주의:
- 제목, 번호, 고정 텍스트는 필드가 아닙니다
- "(빈칸)"으로 표시된 영역 중 사용자가 내용을 작성해야 하는 곳만 필드입니다
- 이미 발견된 필드와 중복되지 않게 해주세요
- JSON 배열만 반환하세요`;

  try {
    const response = await callClaude({
      model: "claude-haiku-4-5-20251001",
      system:
        "당신은 한국 정부지원사업 양식 분석 전문가입니다. JSON만 반환하세요.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 2048,
      temperature: 0.1,
    });

    // JSON 추출
    const jsonMatch = response.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      label: string;
      type: string;
      paraIndex: number;
      sectionFile: string;
    }>;

    // 이미 있는 라벨과 중복 제거
    const existingLabels = new Set(existingFields.map((f) => f.label));
    const baseCount = existingFields.length;

    return parsed
      .filter((p) => !existingLabels.has(p.label))
      .map((p, i) => ({
        id: `field_ai_${baseCount + i}`,
        label: p.label,
        type: (p.type || "text") as "text" | "textarea" | "table_cell",
        xpath: `p[${p.paraIndex}]`,
        sectionFile: p.sectionFile || "Contents/section0.xml",
        context: {
          sectionTitle: "",
          subsectionTitle: "",
          precedingText: "",
        },
        isInTable: p.type === "table_cell",
        isEmpty: true,
      }));
  } catch (error) {
    console.warn("[form-parser] AI 보조 파싱 실패:", error);
    return [];
  }
}

// ===== 메인 파싱 함수 =====

/**
 * HWPX 파일에서 양식 구조를 파싱
 * 규칙 기반 → AI 보조 → 최종 구조 반환
 */
export async function parseForm(
  hwpxBuffer: Buffer,
  useAI: boolean = true
): Promise<ParsedForm> {
  const zip = await JSZip.loadAsync(hwpxBuffer);

  // section*.xml 파일 찾기
  const sectionFiles = Object.keys(zip.files)
    .filter((name) => /Contents\/section\d+\.xml$/.test(name))
    .sort();

  const allNodes: TextNode[] = [];
  const rawXmlMap: Record<string, string> = {};
  const xmlTexts: Record<string, string[]> = {};
  let title = "";

  for (const sectionFile of sectionFiles) {
    const xml = await zip.file(sectionFile)!.async("string");
    rawXmlMap[sectionFile] = xml;

    const nodes = extractTextNodes(xml, sectionFile);
    allNodes.push(...nodes);

    // 텍스트 목록 (AI용)
    xmlTexts[sectionFile] = nodes.map((n) => n.text);

    // 첫 번째 비어있지 않은 텍스트 = 제목
    if (!title) {
      const firstText = nodes.find((n) => n.text.length > 0);
      if (firstText) title = firstText.text;
    }
  }

  // 1. 규칙 기반 필드 탐지
  let fields = detectFields(allNodes);

  // 2. AI 보조 파싱 (필드가 부족하고 AI 사용 가능한 경우)
  if (useAI && fields.length < 3 && allNodes.length > 10) {
    const aiFields = await aiAssistedParse(xmlTexts, fields);
    fields = [...fields, ...aiFields];
  }

  // 3. 섹션 구조 추출
  const structure = extractStructure(allNodes, fields);

  return {
    fields,
    structure,
    rawXmlMap,
    metadata: {
      title,
      totalFields: fields.length,
      complexity: assessComplexity(fields),
    },
  };
}

/**
 * 간단한 동기 파싱 (AI 없이 규칙 기반만)
 * 빠른 필드 확인용
 */
export async function parseFormQuick(
  hwpxBuffer: Buffer
): Promise<ParsedForm> {
  return parseForm(hwpxBuffer, false);
}
