/**
 * Smart Fill 파이프라인 테스트
 * DB/Supabase 없이 로컬에서 form-parser → field-mapper → form-filler 검증
 *
 * 실행: npx tsx scripts/test-smart-fill-pipeline.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import JSZip from "jszip";

// ===== 1. 실제 정부양식 시뮬레이션 HWPX 생성 =====
// {{placeholder}} 없이, 실제 양식처럼 라벨 + 빈칸 구조

const NS = `xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core" xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head"`;

let paraId = 0;
function p(text: string, charPr = 0, paraPr = 0): string {
  const id = paraId++;
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<hp:p id="${id}" paraPrIDRef="${paraPr}" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="${charPr}"><hp:t>${escaped}</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
}

function emptyP(): string {
  const id = paraId++;
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t></hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
}

function emptyPSelfClose(): string {
  const id = paraId++;
  return `<hp:p id="${id}" paraPrIDRef="0" styleIDRef="0" pageBreak="0" columnBreak="0" merged="0"><hp:run charPrIDRef="0"><hp:t/></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="42520" flags="393216"/></hp:linesegarray></hp:p>`;
}

async function buildRealisticForm(): Promise<Buffer> {
  paraId = 0;
  const parts: string[] = [];

  // 제목
  parts.push(p("2026년 예비창업패키지 사업계획서", 1, 1));
  parts.push(emptyP());

  // === 섹션 1: 창업 아이템 개요 ===
  parts.push(p("1. 창업 아이템 개요", 2, 2));
  parts.push(emptyP());

  // 라벨 + 빈칸 패턴 (실제 정부양식 스타일)
  parts.push(p("아이템명:", 0, 0));
  parts.push(emptyP());  // 여기에 작성

  parts.push(p("1-1. 아이템 소개", 3, 2));
  parts.push(emptyP());  // textarea 영역
  parts.push(emptyP());  // 연속 빈칸 = textarea

  parts.push(p("1-2. 개발 동기 및 배경", 3, 2));
  parts.push(emptyP());
  parts.push(emptyP());

  // === 섹션 2: 시장 분석 ===
  parts.push(p("2. 시장 및 경쟁 분석", 2, 2));
  parts.push(emptyP());

  parts.push(p("2-1. 목표 시장 규모", 3, 2));
  parts.push(emptyP());
  parts.push(emptyP());

  parts.push(p("2-2. 경쟁 현황 분석", 3, 2));
  parts.push(emptyPSelfClose()); // self-closing 빈 태그
  parts.push(emptyPSelfClose());

  // === 섹션 3: 사업화 계획 ===
  parts.push(p("3. 사업화 전략", 2, 2));
  parts.push(emptyP());

  parts.push(p("수익모델:", 0, 0));
  parts.push(emptyP());

  parts.push(p("3-1. 출시 로드맵", 3, 2));
  parts.push(emptyP());
  parts.push(emptyP());

  // === 섹션 4: 자금 계획 ===
  parts.push(p("4. 자금 소요 및 조달 계획", 2, 2));
  parts.push(emptyP());
  parts.push(emptyP());

  // === 섹션 5: 팀 구성 ===
  parts.push(p("5. 팀 구성", 2, 2));
  parts.push(emptyP());

  parts.push(p("대표자 이력:", 0, 0));
  parts.push(emptyP());

  parts.push(p("5-1. 팀원 현황", 3, 2));
  parts.push(emptyP());
  parts.push(emptyP());

  const sectionXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes" ?>\n<hs:sec ${NS}>\n${parts.join("\n")}\n</hs:sec>`;

  // 최소 HWPX ZIP 구조
  const zip = new JSZip();
  zip.file("mimetype", "application/hwp+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="UTF-8"?><container/>`);
  zip.file("Contents/section0.xml", sectionXml);
  zip.file("Contents/content.hpf", `<?xml version="1.0" encoding="UTF-8"?><package/>`);
  zip.file("Contents/header.xml", `<?xml version="1.0" encoding="UTF-8"?><head/>`);

  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

// ===== 2. 사업계획서 데이터 =====

const planSections = [
  {
    section_order: 1,
    section_name: "창업 아이템 개요",
    content: `반려동물 구강건강 AI 진단 플랫폼 'PetDent AI'

반려동물 구강 사진을 AI로 분석하여 치석, 치주질환을 조기 진단하는 모바일 플랫폼입니다.

주요 기능:
- 스마트폰 카메라로 반려동물 구강 촬영
- AI 딥러닝 모델이 5초 내 진단 결과 제공
- 주기적 모니터링으로 질환 진행 추적

반려동물 1,500만 시대, 구강질환은 반려견의 80%가 3세 이후 겪는 가장 흔한 질환입니다.
조기 발견 시 치료비 70% 절감이 가능합니다.`,
  },
  {
    section_order: 2,
    section_name: "시장 및 경쟁 분석",
    content: `국내 반려동물 헬스케어 시장: 2.1조 원 (2025년 기준, 연 18% 성장)

TAM: 2.1조 원 (반려동물 헬스케어 전체)
SAM: 3,200억 원 (구강건강 관련 제품/서비스)
SOM: 160억 원 (AI 진단 서비스)

직접 경쟁사:
- 펫닥: 원격진료 플랫폼, AI 진단 기능 없음
- 핏펫: 혈액검사 키트 중심, 구강 특화 아님

당사 차별점: 구강 특화 AI 모델 (정확도 94.2%)`,
  },
  {
    section_order: 3,
    section_name: "사업화 전략",
    content: `Freemium + B2B 이중 구조:

[B2C] 소비자 앱
- 기본 진단: 무료 (월 3회)
- 프리미엄 구독: 월 4,900원
- 2026년 목표: 유료 구독자 15,000명

Phase 1 (1-4개월): MVP 개발 - AI 모델 고도화
Phase 2 (5-8개월): 정식 출시 + 마케팅
Phase 3 (9-12개월): B2B SaaS 정식 출시`,
  },
  {
    section_order: 4,
    section_name: "자금 소요 및 조달 계획",
    content: `총 소요자금: 3억원

정부지원금: 1억원 (예비창업패키지)
- AI 모델 개발 및 서버: 4,000만원
- 앱 개발: 3,000만원
- 마케팅: 2,000만원
- 데이터 라이선스: 1,000만원

자부담: 1억원 / 추가 투자: 1억원 (시드)`,
  },
  {
    section_order: 5,
    section_name: "팀 구성",
    content: `박건강 대표 (수의학 석사)
- 서울대학교 수의과대학 석사 (AI 진단 연구)
- 네이버 AI Lab 3년 근무
- 수의학 AI 논문 3편 게재

CTO 김개발 (석사, 컴퓨터공학) - 카카오 AI 팀 4년
수의사 자문위원 이수의 (박사) - 서울대 동물병원 교수`,
  },
];

// ===== 3. 테스트 실행 =====

async function main() {
  const outDir = join(process.cwd(), "test-output");
  mkdirSync(outDir, { recursive: true });

  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║  Smart Fill 파이프라인 테스트 (DB 없이 로컬 검증)       ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Step 1: 실제 양식 시뮬레이션 HWPX 생성
  console.log("▶ Step 1: 실제 정부양식 시뮬레이션 HWPX 생성 (placeholder 없음)");
  const formBuffer = await buildRealisticForm();
  const formPath = join(outDir, "realistic_form_template.hwpx");
  writeFileSync(formPath, formBuffer);
  console.log(`  파일: ${formPath} (${(formBuffer.length / 1024).toFixed(1)}KB)`);

  // Step 2: form-parser 테스트
  console.log("\n▶ Step 2: form-parser로 양식 필드 추출 (AI 없이 규칙 기반)");
  const { parseForm } = await import("../src/lib/hwpx/form-parser");
  const parsed = await parseForm(formBuffer, false); // AI 사용 안 함

  console.log(`  제목: ${parsed.metadata.title}`);
  console.log(`  필드 수: ${parsed.metadata.totalFields}`);
  console.log(`  복잡도: ${parsed.metadata.complexity}`);
  console.log(`  섹션 수: ${parsed.structure.length}`);
  console.log(`  필드 목록:`);
  for (const field of parsed.fields) {
    console.log(`    - [${field.type}] "${field.label}" (${field.xpath}, 테이블: ${field.isInTable})`);
    console.log(`      컨텍스트: ${field.context.sectionTitle} > ${field.context.subsectionTitle}`);
  }

  // Step 3: field-mapper 테스트
  console.log("\n▶ Step 3: field-mapper로 AI 매핑 (규칙 기반 우선)");
  const { mapFieldsToPlan, generateFieldContents } = await import("../src/lib/hwpx/field-mapper");
  const mappings = await mapFieldsToPlan(parsed.fields, planSections);

  console.log(`  매핑 결과: ${mappings.length}개`);
  for (const m of mappings) {
    console.log(`    - "${m.formFieldLabel}" → 섹션${m.planSectionOrder}(${m.planSectionName}) [${m.strategy}, 신뢰도:${m.confidence}]`);
  }

  const skipCount = mappings.filter(m => m.strategy === "skip").length;
  const mappedCount = mappings.length - skipCount;
  console.log(`  매핑률: ${mappedCount}/${parsed.fields.length} (${((mappedCount / Math.max(parsed.fields.length, 1)) * 100).toFixed(0)}%)`);

  // Step 4: 내용 생성 (AI extract/summarize는 스킵, direct만 테스트)
  console.log("\n▶ Step 4: 필드별 내용 생성");
  // AI 없이 직접 매핑만 테스트
  const fieldContents: Record<string, string> = {};
  const sectionMap = new Map(planSections.map(s => [s.section_order, s]));

  for (const mapping of mappings) {
    if (mapping.strategy === "skip") continue;
    const section = sectionMap.get(mapping.planSectionOrder);
    if (section?.content) {
      fieldContents[mapping.formFieldId] = section.content;
    }
  }

  console.log(`  생성된 내용: ${Object.keys(fieldContents).length}개 필드`);
  for (const [id, content] of Object.entries(fieldContents)) {
    console.log(`    - ${id}: "${content.substring(0, 50).replace(/\n/g, " ")}..."`);
  }

  // Step 5: form-filler 테스트
  console.log("\n▶ Step 5: form-filler로 양식에 내용 삽입");
  const { fillForm } = await import("../src/lib/hwpx/form-filler");
  const fillStart = Date.now();
  const result = await fillForm(formBuffer, parsed, fieldContents);
  const fillElapsed = Date.now() - fillStart;

  const filledPath = join(outDir, "smart_filled_form.hwpx");
  writeFileSync(filledPath, result.buffer);
  console.log(`  채움: ${result.filledCount}개 / 스킵: ${result.skippedCount}개`);
  console.log(`  경고: ${result.warnings.length > 0 ? result.warnings.join(", ") : "없음"}`);
  console.log(`  소요: ${fillElapsed}ms`);
  console.log(`  파일: ${filledPath} (${(result.buffer.length / 1024).toFixed(1)}KB)`);

  // Step 6: 검증
  console.log("\n▶ Step 6: 결과 검증");

  // ZIP 구조 확인
  const origZip = await JSZip.loadAsync(formBuffer);
  const filledZip = await JSZip.loadAsync(result.buffer);
  const origFiles = Object.keys(origZip.files).sort();
  const filledFiles = Object.keys(filledZip.files).sort();

  if (JSON.stringify(origFiles) === JSON.stringify(filledFiles)) {
    console.log(`  [PASS] ZIP 구조 동일 (${origFiles.length}개 파일)`);
  } else {
    console.log(`  [FAIL] ZIP 구조 불일치`);
  }

  // 채워진 파일 크기
  if (result.buffer.length > formBuffer.length) {
    console.log(`  [PASS] 채워진 파일이 양식보다 큼 (${formBuffer.length} → ${result.buffer.length} bytes)`);
  } else {
    console.log(`  [WARN] 채워진 파일이 양식보다 작거나 같음`);
  }

  // 채워진 XML에서 실제 내용이 들어갔는지 확인
  const filledXml = await filledZip.file("Contents/section0.xml")!.async("string");
  const hasPetDent = filledXml.includes("PetDent") || filledXml.includes("반려동물");
  console.log(`  [${hasPetDent ? "PASS" : "FAIL"}] 채워진 XML에 사업계획서 내용 포함`);

  // 빈 <hp:t> 태그 카운트 (원본 vs 결과)
  const origXml = await origZip.file("Contents/section0.xml")!.async("string");
  const origEmpty = (origXml.match(/<hp:t><\/hp:t>/g) || []).length +
                    (origXml.match(/<hp:t\/>/g) || []).length;
  const filledEmpty = (filledXml.match(/<hp:t><\/hp:t>/g) || []).length +
                      (filledXml.match(/<hp:t\/>/g) || []).length;
  console.log(`  빈 태그: 원본 ${origEmpty}개 → 결과 ${filledEmpty}개 (${origEmpty - filledEmpty}개 채워짐)`);

  // 요약
  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║                    테스트 결과 요약                      ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log(`║  양식 필드 발견:       ${String(parsed.fields.length).padStart(3)}개                              ║`);
  console.log(`║  매핑 성공:            ${String(mappedCount).padStart(3)}개 (${((mappedCount / Math.max(parsed.fields.length, 1)) * 100).toFixed(0)}%)                           ║`);
  console.log(`║  필드 채움:            ${String(result.filledCount).padStart(3)}개                              ║`);
  console.log(`║  필드 스킵:            ${String(result.skippedCount).padStart(3)}개                              ║`);
  console.log(`║  처리 시간:            ${String(fillElapsed).padStart(3)}ms                             ║`);
  console.log(`║  원본 빈 태그:         ${String(origEmpty).padStart(3)}개                              ║`);
  console.log(`║  결과 빈 태그:         ${String(filledEmpty).padStart(3)}개                              ║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  const success = parsed.fields.length > 0 && result.filledCount > 0 && hasPetDent;
  if (success) {
    console.log("\n=== SMART FILL PIPELINE TEST PASSED ===");
  } else {
    console.log("\n=== SOME TESTS FAILED ===");
    process.exit(1);
  }

  console.log(`\n결과 확인: open "${filledPath}"`);
}

main().catch((e) => {
  console.error("테스트 실패:", e);
  process.exit(1);
});
