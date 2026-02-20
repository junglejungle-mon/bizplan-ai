/**
 * HWP 바이너리 → 텍스트/구조 변환
 *
 * 정부기관 양식의 87%가 HWP 바이너리 형식.
 * LibreOffice(soffice)를 사용하여 HWP → 텍스트 추출.
 *
 * 전략:
 *   1. HWP → soffice로 텍스트 추출 (--convert-to txt)
 *   2. 추출된 텍스트에서 섹션/필드 구조 분석
 *   3. 또는 HWP → HWPX 변환 후 기존 파서 활용
 *
 * 주의: Vercel 환경에서는 LibreOffice가 없으므로 로컬에서만 동작
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, mkdirSync, unlinkSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

/** LibreOffice 실행 파일 경로 */
const SOFFICE_PATHS = [
  "/Users/jeong-gwang-u/homebrew/bin/soffice",
  "/usr/local/bin/soffice",
  "/usr/bin/soffice",
  "/Applications/LibreOffice.app/Contents/MacOS/soffice",
];

function findSoffice(): string | null {
  for (const p of SOFFICE_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * HWP 바이너리 파일을 텍스트로 변환
 * @param hwpPath HWP 파일 경로
 * @returns 추출된 텍스트 또는 null
 */
export async function convertHwpToText(hwpPath: string): Promise<string | null> {
  const soffice = findSoffice();
  if (!soffice) {
    console.warn("[hwp-converter] LibreOffice를 찾을 수 없습니다");
    return null;
  }

  if (!existsSync(hwpPath)) {
    console.warn(`[hwp-converter] HWP 파일 없음: ${hwpPath}`);
    return null;
  }

  const tmpDir = join(tmpdir(), `hwp-convert-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // HWP → TXT 변환
    execSync(
      `"${soffice}" --headless --convert-to txt:Text --outdir "${tmpDir}" "${hwpPath}"`,
      {
        timeout: 30000, // 30초 타임아웃
        stdio: "pipe",
        env: {
          ...process.env,
          HOME: tmpdir(), // LibreOffice 프로필 충돌 방지
        },
      }
    );

    // 변환된 txt 파일 찾기
    const files = readdirSync(tmpDir);
    const txtFile = files.find((f) => f.endsWith(".txt"));

    if (!txtFile) {
      console.warn("[hwp-converter] 변환된 텍스트 파일을 찾을 수 없습니다");
      return null;
    }

    const text = readFileSync(join(tmpDir, txtFile), "utf-8");

    // 임시 파일 정리
    try {
      for (const f of readdirSync(tmpDir)) {
        unlinkSync(join(tmpDir, f));
      }
    } catch { /* ignore cleanup errors */ }

    return text.trim() || null;
  } catch (error) {
    console.error("[hwp-converter] 변환 실패:", error);
    return null;
  }
}

/**
 * HWP 바이너리 → HWPX로 변환 시도
 * (LibreOffice가 HWPX 출력을 지원하지 않을 수 있으므로, 텍스트 추출을 우선)
 */
export async function convertHwpToHwpx(hwpPath: string): Promise<Buffer | null> {
  const soffice = findSoffice();
  if (!soffice) return null;

  if (!existsSync(hwpPath)) return null;

  const tmpDir = join(tmpdir(), `hwp-convert-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // HWP → DOCX 변환 (HWPX 직접 변환은 지원 안 될 수 있음)
    execSync(
      `"${soffice}" --headless --convert-to docx --outdir "${tmpDir}" "${hwpPath}"`,
      {
        timeout: 30000,
        stdio: "pipe",
        env: {
          ...process.env,
          HOME: tmpdir(),
        },
      }
    );

    const files = readdirSync(tmpDir);
    const docxFile = files.find((f) => f.endsWith(".docx"));

    if (!docxFile) return null;

    const buffer = readFileSync(join(tmpDir, docxFile));

    // 정리
    try {
      for (const f of readdirSync(tmpDir)) {
        unlinkSync(join(tmpDir, f));
      }
    } catch { /* ignore */ }

    return buffer;
  } catch (error) {
    console.error("[hwp-converter] HWPX 변환 실패:", error);
    return null;
  }
}

/**
 * HWP 텍스트에서 양식 구조 추출 (간이 파서)
 * LibreOffice로 추출된 텍스트에서 라벨-빈칸 패턴을 분석
 */
export function parseHwpText(text: string): {
  title: string;
  sections: Array<{ title: string; content: string }>;
  fields: Array<{ label: string; isEmpty: boolean }>;
} {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const title = lines[0] || "양식";
  const sections: Array<{ title: string; content: string }> = [];
  const fields: Array<{ label: string; isEmpty: boolean }> = [];

  // 섹션 제목 패턴
  const sectionPattern = /^(?:\d+\.|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+\.|[가나다라마바사아자차카타파하]\.)\s*/;
  const labelPattern = /^(.{2,20})[:：]\s*$/;

  let currentSection: { title: string; content: string } | null = null;

  for (const line of lines) {
    // 섹션 시작
    if (sectionPattern.test(line)) {
      if (currentSection) sections.push(currentSection);
      currentSection = { title: line, content: "" };
      continue;
    }

    // 라벨 패턴 (콜론으로 끝남)
    const labelMatch = line.match(labelPattern);
    if (labelMatch) {
      fields.push({
        label: labelMatch[1].trim(),
        isEmpty: true,
      });
      continue;
    }

    // 콜론 포함 라벨 (값이 비어있는 경우)
    const inlineLabel = line.match(/^(.{2,20})[:：]\s*$/);
    if (inlineLabel) {
      fields.push({
        label: inlineLabel[1].trim(),
        isEmpty: true,
      });
      continue;
    }

    // 일반 텍스트 → 현재 섹션에 추가
    if (currentSection) {
      currentSection.content += line + "\n";
    }
  }

  if (currentSection) sections.push(currentSection);

  return { title, sections, fields };
}

/**
 * LibreOffice가 사용 가능한지 확인
 */
export function isHwpConverterAvailable(): boolean {
  return findSoffice() !== null;
}
