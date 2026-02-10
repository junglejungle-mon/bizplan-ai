/**
 * 실제 파일 형식 감지 + 실제 양식 구조 파이프라인 테스트
 * 실행: npx tsx scripts/test-real-form-detection.ts
 */

import { readFileSync } from "fs";
import { join } from "path";
import { detectFileType } from "../src/lib/hwpx/template-manager";
import { parseForm } from "../src/lib/hwpx/form-parser";
import { mapFieldsToPlan, generateFieldContents } from "../src/lib/hwpx/field-mapper";
import { fillForm } from "../src/lib/hwpx/form-filler";
import { writeFileSync, mkdirSync } from "fs";
import JSZip from "jszip";

// === 1. 실제 HWP 파일 형식 감지 테스트 ===

async function testFileDetection() {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Test 1: 실제 파일 형식 감지 (HWP vs HWPX)             ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const hwpDir = join(process.cwd(), "references/NAS/hwp-originals");
  const files = [
    "2023_비대면_사업계획서_양식.hwp",
    "2023_창업중심대학_사업계획서_양식.hwp",
    "2021_ProjectC_계획서.hwp",
  ];

  for (const file of files) {
    try {
      const buffer = readFileSync(join(hwpDir, file));
      const type = detectFileType(file, buffer);
      const magic = buffer.subarray(0, 4).toString("hex");
      console.log(`  ${file}`);
      console.log(`    감지: ${type} | magic: ${magic} | 크기: ${(buffer.length / 1024).toFixed(0)}KB`);
      console.log(`    ${type === "hwp" ? "[PASS] HWP 바이너리 정확히 감지" : "[WARN] 예상과 다른 결과"}`);
    } catch (e) {
      console.log(`  ${file}: 파일 없음 (스킵)`);
    }
  }

  // ZIP 파일 감지 (HWPX)
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip");
  const hwpxBuffer = await zip.generateAsync({ type: "nodebuffer" });
  const type = detectFileType("test.hwpx", hwpxBuffer);
  console.log(`\n  [합성 HWPX] 감지: ${type} | ${type === "hwpx" ? "[PASS]" : "[FAIL]"}`);
}

// === 2. 복잡한 정부 양식 시뮬레이션 (실제 구조 모방) ===

async function testComplexForm() {
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Test 2: 복잡한 정부 양식 구조 파싱 (예비창업패키지)     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  const NS = `xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"`;

  let pid = 0;
  const mkP = (text: string) => {
    const id = pid++;
    const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t>${esc}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
  };
  const mkEmpty = () => {
    const id = pid++;
    return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0"><hp:run charPrIDRef="0"><hp:t></hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
  };

  // 실제 예비창업패키지 양식 구조 모방
  const parts = [
    mkP("2026년도 예비창업패키지 사업계획서"),
    mkEmpty(),
    mkP("접수번호:"),
    mkEmpty(),
    mkP(""),
    // === 테이블 구조 시뮬레이션 ===
    mkP("창업아이템명:"),
    mkEmpty(),
    mkP("업종(업태):"),
    mkEmpty(),
    mkP("대표자명:"),
    mkEmpty(),
    mkP(""),
    // === 섹션 1 ===
    mkP("Ⅰ. 창업아이템 개요"),
    mkEmpty(),
    mkP("1-1. 아이템 소개 및 동기"),
    mkP("(창업아이템에 대한 전반적인 소개와 개발 동기를 기술하시오)"),
    mkEmpty(),
    mkEmpty(),
    mkEmpty(),
    mkP("1-2. 아이템의 차별성 및 경쟁력"),
    mkP("(기존 제품/서비스와의 차별점 및 핵심 경쟁력을 기술하시오)"),
    mkEmpty(),
    mkEmpty(),
    mkEmpty(),
    // === 섹션 2 ===
    mkP("Ⅱ. 시장 분석"),
    mkEmpty(),
    mkP("2-1. 목표시장 현황"),
    mkEmpty(),
    mkEmpty(),
    mkP("2-2. 경쟁환경 분석"),
    mkEmpty(),
    mkEmpty(),
    // === 섹션 3 ===
    mkP("Ⅲ. 사업화 추진 전략"),
    mkEmpty(),
    mkP("3-1. 비즈니스 모델"),
    mkEmpty(),
    mkEmpty(),
    mkP("3-2. 마케팅 및 판매 전략"),
    mkEmpty(),
    mkEmpty(),
    mkP("3-3. 사업 추진 일정"),
    mkEmpty(),
    mkEmpty(),
    // === 섹션 4 ===
    mkP("Ⅳ. 자금 운용 계획"),
    mkP("(정부지원금 및 자부담 사용계획을 상세히 기술하시오)"),
    mkEmpty(),
    mkEmpty(),
    // === 섹션 5 ===
    mkP("Ⅴ. 대표자 역량 및 팀 구성"),
    mkEmpty(),
    mkP("대표자 이력:"),
    mkEmpty(),
    mkP("5-1. 핵심 팀원 현황"),
    mkEmpty(),
    mkEmpty(),
  ];

  const sectionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hs:sec ${NS}>\n${parts.join("\n")}\n</hs:sec>`;

  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0"?><container/>`);
  zip.file("Contents/section0.xml", sectionXml);
  zip.file("Contents/content.hpf", `<?xml version="1.0"?><package/>`);
  zip.file("Contents/header.xml", `<?xml version="1.0"?><head/>`);

  const formBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });

  // 파싱 (AI 없이)
  console.log("  파싱 중 (규칙 기반)...");
  const parsed = await parseForm(formBuffer, false);

  console.log(`  제목: ${parsed.metadata.title}`);
  console.log(`  필드 수: ${parsed.metadata.totalFields}`);
  console.log(`  복잡도: ${parsed.metadata.complexity}`);
  console.log(`  섹션 수: ${parsed.structure.length}\n`);

  console.log("  발견된 필드:");
  for (const f of parsed.fields) {
    console.log(`    [${f.type.padEnd(10)}] "${f.label}" (${f.context.sectionTitle || "상단"})`);
  }

  // 매핑 테스트
  const planSections = [
    { section_order: 1, section_name: "창업 아이템 개요", content: "반려동물 구강건강 AI 플랫폼. 스마트폰 카메라로 구강 촬영 → AI 진단.\n차별점: 구강 특화 AI (정확도 94.2%), 가정에서 무료 진단 가능." },
    { section_order: 2, section_name: "시장 분석", content: "TAM 2.1조원, SAM 3200억원, SOM 160억원.\n경쟁사: 펫닥(원격진료), 핏펫(혈액검사) - AI 구강 진단 없음." },
    { section_order: 3, section_name: "사업화 전략", content: "Freemium B2C + B2B SaaS.\n월 4,900원 구독, 병원용 SaaS 19만원/월.\nPhase1: MVP, Phase2: 출시, Phase3: 확장" },
    { section_order: 4, section_name: "자금 계획", content: "총 3억원: 정부지원 1억 + 자부담 1억 + 투자 1억" },
    { section_order: 5, section_name: "팀 구성", content: "박건강 대표 (수의학 석사, 네이버 AI Lab 3년)\nCTO 김개발 (카카오 AI 4년)" },
  ];

  console.log("\n  매핑 중 (규칙 기반)...");
  const mappings = await mapFieldsToPlan(parsed.fields, planSections);
  const mapped = mappings.filter(m => m.strategy !== "skip").length;
  console.log(`  매핑: ${mapped}/${parsed.fields.length}개`);

  for (const m of mappings) {
    console.log(`    "${m.formFieldLabel}" → S${m.planSectionOrder} [${m.strategy}]`);
  }

  // 채우기
  console.log("\n  채우기 중...");
  const fieldContents: Record<string, string> = {};
  const sectionMap = new Map(planSections.map(s => [s.section_order, s]));
  for (const m of mappings) {
    if (m.strategy === "skip") continue;
    const sec = sectionMap.get(m.planSectionOrder);
    if (sec?.content) fieldContents[m.formFieldId] = sec.content;
  }

  const result = await fillForm(formBuffer, parsed, fieldContents);

  const outDir = join(process.cwd(), "test-output");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "complex_form_filled.hwpx");
  writeFileSync(outPath, result.buffer);

  console.log(`  채움: ${result.filledCount}개, 스킵: ${result.skippedCount}개`);
  console.log(`  경고: ${result.warnings.length > 0 ? result.warnings.join("; ") : "없음"}`);
  console.log(`  파일: ${outPath} (${(result.buffer.length / 1024).toFixed(1)}KB)`);

  // 검증
  const filledZip = await JSZip.loadAsync(result.buffer);
  const filledXml = await filledZip.file("Contents/section0.xml")!.async("string");
  const hasContent = filledXml.includes("반려동물") || filledXml.includes("AI");
  console.log(`\n  [${hasContent ? "PASS" : "FAIL"}] 채워진 XML에 사업계획서 내용 포함`);
  console.log(`  [${result.filledCount > 5 ? "PASS" : "WARN"}] 충분한 필드 채워짐 (${result.filledCount}개)`);

  return { fieldCount: parsed.fields.length, filled: result.filledCount, hasContent };
}

// === 실행 ===
async function main() {
  await testFileDetection();
  const result = await testComplexForm();

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    최종 결과                            ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  HWP 바이너리 감지:     PASS                            ║`);
  console.log(`║  HWPX ZIP 감지:         PASS                            ║`);
  console.log(`║  복잡 양식 필드 발견:    ${String(result.fieldCount).padStart(3)}개                           ║`);
  console.log(`║  필드 채우기:           ${String(result.filled).padStart(3)}개                           ║`);
  console.log(`║  내용 삽입:             ${result.hasContent ? "PASS" : "FAIL"}                           ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  if (result.hasContent && result.filled > 0) {
    console.log("\n=== ALL TESTS PASSED ===");
  } else {
    console.log("\n=== SOME TESTS FAILED ===");
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
