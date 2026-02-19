/**
 * 사업계획서 HWPX 생성 유틸리티
 * HWPX = ZIP(mimetype + META-INF + Contents(header.xml + section*.xml) + version.xml + settings.xml)
 * OWPML 기반 - 실제 한컴오피스 한글 파일 구조 준수
 */

import JSZip from "jszip";
import { chartsToImages, ChartImageResult } from "@/lib/charts/chart-to-image";
import { getThemeForTemplate } from "@/lib/charts/themes";
import type { ChartDataItem } from "@/lib/charts/svg-renderer";

interface HwpxOptions {
  title: string;
  companyName: string;
  sections: Array<{
    section_name: string;
    content: string | null;
    section_order: number;
  }>;
  chartData?: Record<string, ChartDataItem[]>;
  kpiData?: Record<string, unknown>;
  templateType?: string;
}

// ===== OWPML 네임스페이스 (실제 한컴 규격) =====
const NS = `xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hp10="http://www.hancom.co.kr/hwpml/2016/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hhs="http://www.hancom.co.kr/hwpml/2011/history" xmlns:hm="http://www.hancom.co.kr/hwpml/2011/master-page" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:opf="http://www.idpf.org/2007/opf/" xmlns:ooxmlchart="http://www.hancom.co.kr/hwpml/2016/ooxmlchart" xmlns:hwpunitchar="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar" xmlns:epub="http://www.idpf.org/2007/ops" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"`;

// ===== XML 유틸리티 =====

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ===== charPr 생성 헬퍼 (실제 OWPML 구조 준수) =====
function charPrXml(id: number, height: number, fontRef: number, textColor: string): string {
  return `<hh:charPr id="${id}" height="${height}" textColor="${textColor}" shadeColor="none" useFontSpace="0" useKerning="0" symMark="NONE" borderFillIDRef="2"><hh:fontRef hangul="${fontRef}" latin="${fontRef}" hanja="${fontRef}" japanese="${fontRef}" other="${fontRef}" symbol="${fontRef}" user="${fontRef}"/><hh:ratio hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:spacing hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:relSz hangul="100" latin="100" hanja="100" japanese="100" other="100" symbol="100" user="100"/><hh:offset hangul="0" latin="0" hanja="0" japanese="0" other="0" symbol="0" user="0"/><hh:underline type="NONE" shape="SOLID" color="#000000"/><hh:strikeout shape="NONE" color="#000000"/><hh:outline type="NONE"/><hh:shadow type="NONE" color="#B2B2B2" offsetX="10" offsetY="10"/></hh:charPr>`;
}

// ===== paraPr 생성 헬퍼 (실제 OWPML hp:switch/hp:case/hp:default 구조) =====
function paraPrXml(id: number, align: string, lineSpacing: number, prev: number, next: number): string {
  return `<hh:paraPr id="${id}" tabPrIDRef="0" condense="0" fontLineHeight="0" snapToGrid="1" suppressLineNumbers="0" checked="0"><hh:align horizontal="${align}" vertical="BASELINE"/><hh:heading type="NONE" idRef="0" level="0"/><hh:breakSetting breakLatinWord="KEEP_WORD" breakNonLatinWord="BREAK_WORD" widowOrphan="0" keepWithNext="0" keepLines="0" pageBreakBefore="0" lineWrap="BREAK"/><hh:autoSpacing eAsianEng="0" eAsianNum="0"/><hp:switch><hp:case hp:required-namespace="http://www.hancom.co.kr/hwpml/2016/HwpUnitChar"><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev}" unit="HWPUNIT"/><hc:next value="${next}" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="${lineSpacing}" unit="HWPUNIT"/></hp:case><hp:default><hh:margin><hc:intent value="0" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/><hc:right value="0" unit="HWPUNIT"/><hc:prev value="${prev * 2}" unit="HWPUNIT"/><hc:next value="${next * 2}" unit="HWPUNIT"/></hh:margin><hh:lineSpacing type="PERCENT" value="${lineSpacing}" unit="HWPUNIT"/></hp:default></hp:switch><hh:border borderFillIDRef="2" offsetLeft="0" offsetRight="0" offsetTop="0" offsetBottom="0" connect="0" ignoreMargin="0"/></hh:paraPr>`;
}

// ===== HWPX 고정 파일 생성 =====

function buildMimetype(): string {
  return "application/hwp+zip";
}

function buildVersionXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hv:HCFVersion xmlns:hv="http://www.hancom.co.kr/hwpml/2011/version" tagetApplication="WORDPROCESSOR" major="5" minor="0" micro="5" buildNumber="0" os="1" xmlVersion="1.4" application="Hancom Office Hangul" appVersion="9, 1, 1, 5656 WIN32LEWindows_Unknown_Version"/>`;
}

function buildSettingsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ha:HWPApplicationSetting xmlns:ha="http://www.hancom.co.kr/hwpml/2011/app" xmlns:config="urn:oasis:names:tc:opendocument:xmlns:config:1.0"><ha:CaretPosition listIDRef="0" paraIDRef="0" pos="0"/></ha:HWPApplicationSetting>`;
}

function buildContainerXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><ocf:container xmlns:ocf="urn:oasis:names:tc:opendocument:xmlns:container" xmlns:hpf="http://www.hancom.co.kr/schema/2011/hpf"><ocf:rootfiles><ocf:rootfile full-path="Contents/content.hpf" media-type="application/hwpml-package+xml"/><ocf:rootfile full-path="Preview/PrvText.txt" media-type="text/plain"/></ocf:rootfiles></ocf:container>`;
}

function buildManifestXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><odf:manifest xmlns:odf="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"/>`;
}

function buildContentHpf(title: string, binFileCount: number = 0): string {
  const now = new Date().toISOString().replace(/\.\d+Z/, "Z");

  // BinData 이미지 manifest 항목 생성
  const binManifestItems = Array.from({ length: binFileCount }, (_, i) => {
    const binId = `BIN${String(i).padStart(4, "0")}`;
    return `<opf:item id="${binId}" href="BinData/${binId}.png" media-type="image/png"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><opf:package ${NS} version="" unique-identifier="" id=""><opf:metadata><opf:title>${escapeXml(title)}</opf:title><opf:language>ko</opf:language><opf:meta name="creator" content="text">BizPlan AI</opf:meta><opf:meta name="subject" content="text"/><opf:meta name="description" content="text"/><opf:meta name="lastsaveby" content="text">BizPlan AI</opf:meta><opf:meta name="CreatedDate" content="text">${now}</opf:meta><opf:meta name="ModifiedDate" content="text">${now}</opf:meta><opf:meta name="date" content="text">${now}</opf:meta><opf:meta name="keyword" content="text"/></opf:metadata><opf:manifest><opf:item id="header" href="Contents/header.xml" media-type="application/xml"/><opf:item id="section0" href="Contents/section0.xml" media-type="application/xml"/><opf:item id="settings" href="settings.xml" media-type="application/xml"/>${binManifestItems}</opf:manifest><opf:spine><opf:itemref idref="header"/><opf:itemref idref="section0" linear="no"/></opf:spine></opf:package>`;
}

// ===== Header XML (폰트, 스타일, 단락 속성 정의) =====

function buildHeaderXml(primaryColor: string, binFileCount: number = 0): string {
  // fontface 7개 언어 (HANGUL, LATIN, HANJA, JAPANESE, OTHER, SYMBOL, USER)
  const langs = ["HANGUL", "LATIN", "HANJA", "JAPANESE", "OTHER", "SYMBOL", "USER"];
  const fontfacesXml = langs.map(lang =>
    `<hh:fontface lang="${lang}" fontCnt="2"><hh:font id="0" face="함초롬돋움" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="8" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font><hh:font id="1" face="함초롬바탕" type="TTF" isEmbedded="0"><hh:typeInfo familyType="FCAT_GOTHIC" weight="8" proportion="4" contrast="0" strokeVariation="1" armStyle="1" letterform="1" midline="1" xHeight="1"/></hh:font></hh:fontface>`
  ).join("");

  // borderFills
  const borderFillsXml = `<hh:borderFills itemCnt="2"><hh:borderFill id="1" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/></hh:borderFill><hh:borderFill id="2" threeD="0" shadow="0" centerLine="NONE" breakCellSeparateLine="0"><hh:slash type="NONE" Crooked="0" isCounter="0"/><hh:backSlash type="NONE" Crooked="0" isCounter="0"/><hh:leftBorder type="NONE" width="0.1 mm" color="#000000"/><hh:rightBorder type="NONE" width="0.1 mm" color="#000000"/><hh:topBorder type="NONE" width="0.1 mm" color="#000000"/><hh:bottomBorder type="NONE" width="0.1 mm" color="#000000"/><hh:diagonal type="SOLID" width="0.1 mm" color="#000000"/><hc:fillBrush><hc:winBrush faceColor="none" hatchColor="#FF000000" alpha="0"/></hc:fillBrush></hh:borderFill></hh:borderFills>`;

  // charProperties (0=본문10pt, 1=제목24pt, 2=제목16pt, 3=소제목12pt, 4=작은9pt회색)
  // bold 없이 fontRef=1(함초롬바탕)로 제목 구분 - 실제 OWPML은 bold를 charPr 자식으로 쓰지 않음
  const charPropsXml = `<hh:charProperties itemCnt="5">${charPrXml(0, 1000, 0, "#000000")}${charPrXml(1, 2400, 1, primaryColor)}${charPrXml(2, 1600, 1, primaryColor)}${charPrXml(3, 1200, 1, "#000000")}${charPrXml(4, 900, 0, "#808080")}</hh:charProperties>`;

  // tabProperties
  const tabPropsXml = `<hh:tabProperties itemCnt="1"><hh:tabPr id="0" autoTabLeft="0" autoTabRight="0"/></hh:tabProperties>`;

  // paraProperties: 0=본문(JUSTIFY), 1=제목중앙(CENTER), 2=소제목(JUSTIFY+여백), 3=기본(JUSTIFY 160%)
  // 실제 샘플 paraPrIDRef="3"을 참조하므로 3번도 필요
  const paraPropsXml = `<hh:paraProperties itemCnt="4">${paraPrXml(0, "JUSTIFY", 160, 0, 0)}${paraPrXml(1, "CENTER", 160, 400, 200)}${paraPrXml(2, "JUSTIFY", 160, 200, 100)}${paraPrXml(3, "JUSTIFY", 160, 0, 0)}</hh:paraProperties>`;

  // styles
  const stylesXml = `<hh:styles itemCnt="2"><hh:style id="0" type="PARA" name="바탕글" engName="Normal" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="0" langID="1042" lockForm="0"/><hh:style id="1" type="PARA" name="본문" engName="Body" paraPrIDRef="0" charPrIDRef="0" nextStyleIDRef="1" langID="1042" lockForm="0"/></hh:styles>`;

  // binData (이미지 참조)
  let binDataXml = "";
  if (binFileCount > 0) {
    const binItems = Array.from({ length: binFileCount }, (_, i) => {
      const binId = `BIN${String(i).padStart(4, "0")}`;
      return `<hh:binItem id="${i}" src="BinData/${binId}.png" format="PNG" isEmbeded="1"/>`;
    }).join("");
    binDataXml = `<hh:binData itemCnt="${binFileCount}">${binItems}</hh:binData>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?><hh:head ${NS} version="1.4" secCnt="1"><hh:beginNum page="1" footnote="1" endnote="1" pic="1" tbl="1" equation="1"/><hh:refList><hh:fontfaces itemCnt="7">${fontfacesXml}</hh:fontfaces>${borderFillsXml}${charPropsXml}${tabPropsXml}${paraPropsXml}${stylesXml}${binDataXml}</hh:refList><hh:compatibleDocument targetProgram="HWP201X"><hh:layoutCompatibility/></hh:compatibleDocument><hh:docOption><hh:linkinfo path="" pageInherit="0" footnoteInherit="0"/></hh:docOption><hh:trackchageConfig flags="56"/></hh:head>`;
}

// ===== Section XML 빌드 =====

let _paraId = 0;
function nextParaId(): number {
  return _paraId++;
}

/** secPr - 페이지 설정 (첫 번째 단락의 run 안에 들어감) */
function secPrXml(): string {
  return `<hp:secPr id="" textDirection="HORIZONTAL" spaceColumns="1134" tabStop="8000" tabStopVal="4000" tabStopUnit="HWPUNIT" outlineShapeIDRef="1" memoShapeIDRef="0" textVerticalWidthHead="0" masterPageCnt="0"><hp:grid lineGrid="0" charGrid="0" wonggojiFormat="0"/><hp:startNum pageStartsOn="BOTH" page="0" pic="0" tbl="0" equation="0"/><hp:visibility hideFirstHeader="0" hideFirstFooter="0" hideFirstMasterPage="0" border="SHOW_ALL" fill="SHOW_ALL" hideFirstPageNum="0" hideFirstEmptyLine="0" showLineNumber="0"/><hp:lineNumberShape restartType="0" countBy="0" distance="0" startNumber="0"/><hp:pagePr landscape="WIDELY" width="59528" height="84188" gutterType="LEFT_ONLY"><hp:margin header="4252" footer="4252" gutter="0" left="8504" right="8504" top="5668" bottom="4252"/></hp:pagePr><hp:footNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="-1" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="283" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="EACH_COLUMN" beneathText="0"/></hp:footNotePr><hp:endNotePr><hp:autoNumFormat type="DIGIT" userChar="" prefixChar="" suffixChar=")" supscript="0"/><hp:noteLine length="14692344" type="SOLID" width="0.12 mm" color="#000000"/><hp:noteSpacing betweenNotes="0" belowLine="567" aboveLine="850"/><hp:numbering type="CONTINUOUS" newNum="1"/><hp:placement place="END_OF_DOCUMENT" beneathText="0"/></hp:endNotePr><hp:pageBorderFill type="BOTH" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="EVEN" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill><hp:pageBorderFill type="ODD" borderFillIDRef="1" textBorder="PAPER" headerInside="0" footerInside="0" fillArea="PAPER"><hp:offset left="1417" right="1417" top="1417" bottom="1417"/></hp:pageBorderFill></hp:secPr>`;
}

/** linesegarray 기본 */
function lineseg(vertpos: number = 0): string {
  return `<hp:linesegarray><hp:lineseg textpos="0" vertpos="${vertpos}" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray>`;
}

/** 일반 텍스트 단락 */
function p(text: string, charPrId = 0, paraPrId = 0, isFirst = false): string {
  const id = nextParaId();
  const secPr = isFirst ? secPrXml() : "";
  return `<hp:p id="${id}" paraPrIDRef="${paraPrId}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPrId}">${secPr}<hp:t>${escapeXml(text)}</hp:t></hp:run>${lineseg()}</hp:p>`;
}

/** 빈 줄 */
function emptyP(): string {
  const id = nextParaId();
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run>${lineseg()}</hp:p>`;
}

// ===== 이미지 고유 ID 카운터 =====
let _shapeId = 100;
function nextShapeId(): number {
  return _shapeId++;
}

/**
 * 이미지 단락 생성 (OWPML <hp:pic> 구조)
 * binItemId: header.xml의 binItem id (0부터)
 * widthEmu, heightEmu: HWPUNIT 단위 크기 (1inch = 7200 HWPUNIT)
 */
function imageParagraph(binItemId: number, widthEmu: number, heightEmu: number): string {
  const paraId = nextParaId();
  const shapeId = nextShapeId();
  const instId = shapeId;

  // 이미지를 본문 폭에 맞게 조정 (최대 42520 HWPUNIT ≈ 약 15cm)
  const maxWidth = 42520;
  if (widthEmu > maxWidth) {
    const scale = maxWidth / widthEmu;
    heightEmu = Math.round(heightEmu * scale);
    widthEmu = maxWidth;
  }

  return `<hp:p id="${paraId}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:pic id="${shapeId}" reverse="0" lock="0" dropcapstyle="None" instid="${instId}" textFlow="BOTH_SIDES" blockoPaGe="0" embedded="1" holdAnchorAndSO="0"><hp:shapeObject id="${shapeId}" zOrder="${shapeId}" numberingType="NONE" textWrap="TOP_AND_BOTTOM" textFlow="BOTH_SIDES"><hp:size width="${widthEmu}" height="${heightEmu}" widthRelTo="ABSOLUTE" heightRelTo="ABSOLUTE"/><hp:position treatAsChar="1" affectLSpacing="0" flowWithText="1" allowOverlap="1" holdAnchorAndSO="0" vertRelTo="PARA" horzRelTo="PARA" vertAlign="TOP" horzAlign="LEFT"><hp:vertOffset value="0"/><hp:horzOffset value="0"/></hp:position></hp:shapeObject><hp:shapeComponent href="" groupLevel="0" instid="${instId}"><hc:offset x0="0" y0="0" x1="${widthEmu}" y1="${heightEmu}" groupLevel="0" flipType="NONE" rotationAngle="0"/><hc:orgSz width="${widthEmu}" height="${heightEmu}"/><hc:imgRect x0="0" y0="0" x1="1" y1="1"/><hc:imgClip left="0" top="0" right="0" bottom="0"/><hc:imgEffect><hc:brightness>0</hc:brightness><hc:contrast>0</hc:contrast></hc:imgEffect></hp:shapeComponent><hc:fillBrush><hc:imgFill type="TILE"><hc:image binaryItemIDRef="${binItemId}"/></hc:imgFill></hc:fillBrush></hp:pic></hp:run>${lineseg()}</hp:p>`;
}

/** 마크다운 → HWPX 단락 배열로 변환 (차트 이미지를 ## 블록 사이에 분산 삽입) */
function markdownToHwpxParagraphs(
  markdown: string,
  chartImages: ChartImageResult[],
  _headerColor: string,
  sectionBinOffset: number
): string[] {
  // ## 소제목 기준으로 블록 분할
  const blocks = markdown.split(/(?=^## )/m);
  const chartsPerBlock = chartImages.length > 0 && blocks.length > 0
    ? Math.max(1, Math.ceil(chartImages.length / blocks.length))
    : 0;

  const parts: string[] = [];
  let imageIdx = 0;

  for (const block of blocks) {
    // 블록 내 라인 처리
    const lines = block.split("\n");

    for (const line of lines) {
      if (line.trim() === "") {
        parts.push(emptyP());
        continue;
      }

      // 테이블 구분선 스킵
      if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
        const cells = line.split("|").slice(1, -1).map((c) => c.trim());
        if (cells.every((c) => /^[-:]+$/.test(c))) continue;
        const text = cells.join(" | ");
        parts.push(p(text, 0, 0));
        continue;
      }

      // ### 소제목
      if (line.startsWith("### ")) {
        parts.push(p(line.replace("### ", ""), 3, 2));
        continue;
      }

      // ## 중제목
      if (line.startsWith("## ")) {
        parts.push(p(line.replace("## ", ""), 2, 2));
        continue;
      }

      // 구분선
      if (line.trim() === "---" || line.trim() === "***") {
        parts.push(emptyP());
        continue;
      }

      // 볼드/이탤릭 제거
      const cleanText = line
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1");

      // 불릿
      if (/^[\s]*[-*•]\s/.test(line)) {
        const text = cleanText.replace(/^[\s]*[-*•]\s+/, "");
        parts.push(p(`  · ${text}`, 0, 0));
        continue;
      }

      // 번호 리스트
      if (/^\d+\.\s/.test(line)) {
        parts.push(p(cleanText, 0, 0));
        continue;
      }

      // 일반 텍스트
      parts.push(p(cleanText, 0, 0));
    }

    // 블록 뒤에 차트 이미지 분배 삽입
    const chartsForThisBlock = Math.min(chartsPerBlock, chartImages.length - imageIdx);
    for (let ci = 0; ci < chartsForThisBlock; ci++) {
      if (imageIdx < chartImages.length) {
        const img = chartImages[imageIdx];
        const widthEmu = Math.round((img.width / 2) * 30);
        const heightEmu = Math.round((img.height / 2) * 30);
        const binItemId = sectionBinOffset + imageIdx;

        parts.push(emptyP());
        parts.push(imageParagraph(binItemId, widthEmu, heightEmu));
        parts.push(emptyP());
        imageIdx++;
      }
    }
  }

  // 남은 이미지가 있으면 섹션 끝에 삽입
  while (imageIdx < chartImages.length) {
    const img = chartImages[imageIdx];
    const widthEmu = Math.round((img.width / 2) * 30);
    const heightEmu = Math.round((img.height / 2) * 30);
    const binItemId = sectionBinOffset + imageIdx;

    parts.push(emptyP());
    parts.push(imageParagraph(binItemId, widthEmu, heightEmu));
    imageIdx++;
  }

  return parts;
}

/** 전체 section0.xml 빌드 */
function buildSectionXml(
  opts: HwpxOptions,
  chartImages: Record<string, ChartImageResult[]>,
  headerColor: string
): string {
  // paraId, shapeId 리셋
  _paraId = 0;
  _shapeId = 100;

  const parts: string[] = [];

  // 첫 번째 단락 → secPr 포함
  parts.push(p(opts.title, 1, 1, true));
  parts.push(emptyP());
  parts.push(p(opts.companyName, 2, 1));
  parts.push(emptyP());

  const today = new Date().toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric",
  });
  parts.push(p(today, 4, 1));
  parts.push(emptyP());
  parts.push(p("본 사업계획서는 BizPlan AI를 활용하여 자동 생성되었습니다.", 4, 1));
  parts.push(emptyP());
  parts.push(emptyP());

  // 목차
  parts.push(p("목 차", 2, 1));
  parts.push(emptyP());
  for (const section of opts.sections) {
    parts.push(p(`${section.section_order}. ${section.section_name}`, 0, 0));
  }
  parts.push(emptyP());
  parts.push(emptyP());

  // binItem 오프셋 계산 (섹션별로 이미지 인덱스를 누적)
  let binOffset = 0;

  // 본문
  for (const section of opts.sections) {
    // 섹션 제목
    parts.push(p(`${section.section_order}. ${section.section_name}`, 2, 2));
    parts.push(emptyP());

    // 섹션 콘텐츠
    const sectionKey = `section_${section.section_order}`;
    const sectionImages = chartImages[sectionKey] || [];

    if (section.content) {
      const paragraphs = markdownToHwpxParagraphs(
        section.content,
        sectionImages,
        headerColor,
        binOffset
      );
      parts.push(...paragraphs);
    } else {
      parts.push(p("(미작성)", 4, 0));
    }

    binOffset += sectionImages.length;
    parts.push(emptyP());
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hs:sec ${NS}>\n${parts.join("\n")}\n</hs:sec>`;
}

// ===== 메인 빌드 함수 =====

export async function buildHwpx(opts: HwpxOptions): Promise<Buffer> {
  const theme = getThemeForTemplate(opts.templateType);

  // 차트 이미지 생성
  let chartImages: Record<string, ChartImageResult[]> = {};
  if (opts.chartData && Object.keys(opts.chartData).length > 0) {
    try {
      chartImages = await chartsToImages(opts.chartData, opts.templateType);
    } catch (error) {
      console.warn("[hwpx-builder] 차트 이미지 생성 실패:", error);
    }
  }

  // 이미지 파일 목록 생성 (전 섹션 순서대로 flatten)
  const flatImages: { binId: string; buffer: Buffer }[] = [];
  for (const section of opts.sections) {
    const sectionKey = `section_${section.section_order}`;
    const sectionImgs = chartImages[sectionKey] || [];
    for (const img of sectionImgs) {
      const binId = `BIN${String(flatImages.length).padStart(4, "0")}`;
      flatImages.push({ binId, buffer: img.pngBuffer });
    }
  }

  const binFileCount = flatImages.length;

  // ZIP 생성
  const zip = new JSZip();

  // mimetype (압축 안 함 - HWPX 규격)
  zip.file("mimetype", buildMimetype(), { compression: "STORE" });

  // META-INF
  zip.file("META-INF/container.xml", buildContainerXml());
  zip.file("META-INF/manifest.xml", buildManifestXml());

  // Root files
  zip.file("version.xml", buildVersionXml());
  zip.file("settings.xml", buildSettingsXml());

  // BinData (차트 이미지)
  for (const { binId, buffer } of flatImages) {
    zip.file(`BinData/${binId}.png`, buffer);
  }

  // Contents
  zip.file("Contents/content.hpf", buildContentHpf(opts.title, binFileCount));
  zip.file("Contents/header.xml", buildHeaderXml(theme.primary, binFileCount));
  zip.file("Contents/section0.xml", buildSectionXml(opts, chartImages, theme.primary));

  // Preview
  zip.file("Preview/PrvText.txt", opts.title);

  // ZIP → Buffer
  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return buffer;
}
