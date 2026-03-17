/**
 * 양식폼 다운로드 + Supabase Storage 저장 + 캐시 관리
 *
 * 흐름:
 *   1. programs.attachment_urls에서 file URL 추출
 *   2. HTTP 다운로드 (정부사이트 리다이렉트 처리)
 *   3. Magic bytes로 hwpx(ZIP) vs hwp(바이너리) 판별
 *   4. hwpx만 처리 (hwp → status='failed')
 *   5. Supabase Storage 저장 + DB 메타데이터 기록
 *
 * v2: 로컬 파일 우선 로드 지원
 *   - 로컬 환경: data/programs/{source}/{source_id}/*.hwpx 에서 우선 로드
 *   - Vercel 환경: 기존 Supabase Storage에서 로드
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormTemplate } from "./types";
import { existsSync, readFileSync, readdirSync } from "fs";
import {
  convertHwpToHwpx,
  isHwpConverterAvailable,
} from "./hwp-converter";

// ===== Magic Bytes =====

/** HWPX는 ZIP 포맷 (PK 헤더) */
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
/** HWP 바이너리 포맷 (OLE Compound File) */
const HWP_MAGIC = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

/** 파일 유형 감지 (magic bytes + URL 힌트) */
export function detectFileType(
  url: string,
  buffer: Buffer
): "hwpx" | "hwp" | "unknown" {
  // Magic bytes 우선
  if (buffer.length >= 4) {
    if (buffer.subarray(0, 4).equals(ZIP_MAGIC)) return "hwpx";
    if (buffer.subarray(0, 4).equals(HWP_MAGIC)) return "hwp";
  }

  // URL 확장자 폴백
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes(".hwpx")) return "hwpx";
  if (lowerUrl.includes(".hwp")) return "hwp";

  return "unknown";
}

// ===== attachment_urls 파싱 =====

/** programs.attachment_urls에서 HWP/HWPX URL 추출 */
export function extractFormUrls(
  attachmentUrls: Record<string, unknown> | null
): string[] {
  if (!attachmentUrls) return [];

  const urls: string[] = [];

  // 여러 가지 가능한 구조 처리
  // 1. { files: [{ url, name }] }
  if (Array.isArray(attachmentUrls.files)) {
    for (const file of attachmentUrls.files) {
      const f = file as Record<string, unknown>;
      const url = (f.url || f.href || f.link) as string | undefined;
      if (url && isFormUrl(url)) urls.push(url);
    }
  }

  // 2. { url: "...", urls: ["..."] }
  if (typeof attachmentUrls.url === "string") {
    if (isFormUrl(attachmentUrls.url)) urls.push(attachmentUrls.url);
  }
  if (Array.isArray(attachmentUrls.urls)) {
    for (const url of attachmentUrls.urls) {
      if (typeof url === "string" && isFormUrl(url)) urls.push(url);
    }
  }

  // 3. 플랫 객체 { "사업계획서양식.hwpx": "https://..." }
  for (const [key, val] of Object.entries(attachmentUrls)) {
    if (typeof val === "string" && val.startsWith("http") && isFormUrl(val)) {
      urls.push(val);
    }
    if (typeof val === "string" && val.startsWith("http") && isFormUrl(key)) {
      urls.push(val);
    }
  }

  return [...new Set(urls)]; // 중복 제거
}

function isFormUrl(urlOrName: string): boolean {
  const lower = urlOrName.toLowerCase();
  return (
    lower.includes(".hwpx") ||
    lower.includes(".hwp") ||
    lower.includes("사업계획서") ||
    lower.includes("양식") ||
    lower.includes("신청서")
  );
}

// ===== 다운로드 =====

/** URL에서 파일 다운로드 (리다이렉트 자동 처리) */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`다운로드 실패: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ===== 메인 API =====

/** DB에서 캐시된 양식 템플릿 조회 */
export async function getFormTemplate(
  supabase: SupabaseClient,
  programId: string
): Promise<FormTemplate | null> {
  const { data } = await supabase
    .from("form_templates")
    .select("*")
    .eq("program_id", programId)
    .in("status", ["downloaded", "parsed", "mapped"])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as FormTemplate | null;
}

/**
 * 프로그램의 첨부파일에서 HWPX 양식 다운로드 → Storage 저장
 * 이미 캐시되어 있으면 기존 레코드 반환
 */
export async function downloadAndCacheTemplate(
  supabase: SupabaseClient,
  programId: string
): Promise<FormTemplate | null> {
  // 1. 이미 캐시된 템플릿 확인
  const cached = await getFormTemplate(supabase, programId);
  if (cached) return cached;

  // 2. 프로그램의 attachment_urls 조회
  const { data: program } = await supabase
    .from("programs")
    .select("attachment_urls")
    .eq("id", programId)
    .single();

  if (!program?.attachment_urls) return null;

  const formUrls = extractFormUrls(
    program.attachment_urls as Record<string, unknown>
  );
  if (formUrls.length === 0) return null;

  // 3. 첫 번째 양식 URL 다운로드
  const sourceUrl = formUrls[0];

  try {
    const buffer = await downloadFile(sourceUrl);
    const fileType = detectFileType(sourceUrl, buffer);

    // HWP (바이너리) 형식 → LibreOffice로 변환 시도
    if (fileType === "hwp") {
      if (isHwpConverterAvailable()) {
        const convertedBuffer = await tryConvertHwp(buffer, programId, supabase);
        if (convertedBuffer) {
          // 변환 성공 → HWPX로 처리 계속
          const storagePath = `form-templates/${programId}/${Date.now()}.hwpx`;
          const { error: uploadError } = await supabase.storage
            .from("documents")
            .upload(storagePath, convertedBuffer, {
              contentType: "application/hwp+zip",
              upsert: true,
            });

          if (uploadError) {
            console.warn("[template-manager] Storage 업로드 실패:", uploadError.message);
          }

          const { data: record } = await supabase
            .from("form_templates")
            .upsert(
              {
                program_id: programId,
                source_url: sourceUrl,
                file_type: "hwpx",
                file_size: convertedBuffer.length,
                storage_path: storagePath,
                status: "downloaded",
                error_message: null,
              },
              { onConflict: "program_id,source_url" }
            )
            .select()
            .single();
          return record as FormTemplate | null;
        }
        // 변환 실패 → HWP 텍스트 추출이라도 시도 (스킬화용)
        console.warn("[template-manager] HWP → HWPX 변환 실패, 텍스트 추출만 시도");
      }

      // LibreOffice 없거나 변환 실패 시 기존 에러 기록
      const { data: record } = await supabase
        .from("form_templates")
        .upsert(
          {
            program_id: programId,
            source_url: sourceUrl,
            file_type: "hwp",
            file_size: buffer.length,
            status: "failed",
            error_message: isHwpConverterAvailable()
              ? "HWP → HWPX 변환에 실패했습니다. 수동 변환이 필요합니다."
              : "HWP 바이너리 형식은 지원되지 않습니다. LibreOffice가 필요합니다.",
          },
          { onConflict: "program_id,source_url" }
        )
        .select()
        .single();
      return record as FormTemplate | null;
    }

    if (fileType === "unknown") {
      const { data: record } = await supabase
        .from("form_templates")
        .upsert(
          {
            program_id: programId,
            source_url: sourceUrl,
            file_type: "hwpx",
            file_size: buffer.length,
            status: "failed",
            error_message: "파일 형식을 인식할 수 없습니다.",
          },
          { onConflict: "program_id,source_url" }
        )
        .select()
        .single();
      return record as FormTemplate | null;
    }

    // 4. Supabase Storage에 저장
    const storagePath = `form-templates/${programId}/${Date.now()}.hwpx`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, buffer, {
        contentType: "application/hwp+zip",
        upsert: true,
      });

    if (uploadError) {
      console.warn("[template-manager] Storage 업로드 실패:", uploadError.message);
      // Storage 실패해도 DB 기록은 진행
    }

    // 5. DB에 메타데이터 저장
    const { data: record } = await supabase
      .from("form_templates")
      .upsert(
        {
          program_id: programId,
          source_url: sourceUrl,
          file_type: "hwpx",
          file_size: buffer.length,
          storage_path: storagePath,
          status: "downloaded",
        },
        { onConflict: "program_id,source_url" }
      )
      .select()
      .single();

    return record as FormTemplate | null;
  } catch (error) {
    console.error("[template-manager] 다운로드 실패:", error);

    const { data: record } = await supabase
      .from("form_templates")
      .upsert(
        {
          program_id: programId,
          source_url: sourceUrl,
          file_type: "hwpx",
          status: "failed",
          error_message:
            error instanceof Error ? error.message : "알 수 없는 오류",
        },
        { onConflict: "program_id,source_url" }
      )
      .select()
      .single();

    return record as FormTemplate | null;
  }
}

/**
 * HWPX 파일 로드 (로컬 우선 → Supabase Storage 폴백)
 *
 * 1순위: 로컬 파일 (data/programs/{source}/{source_id}/*.hwpx)
 * 2순위: Supabase Storage (Vercel 환경 또는 로컬 파일 없을 때)
 */
export async function downloadTemplateBuffer(
  supabase: SupabaseClient,
  template: FormTemplate
): Promise<Buffer | null> {
  // 1순위: 로컬 파일 로드 (Vercel이 아닌 경우)
  if (!process.env.VERCEL) {
    const localBuffer = await loadFromLocal(supabase, template.program_id);
    if (localBuffer) {
      return localBuffer;
    }
  }

  // 2순위: Supabase Storage
  if (!template.storage_path) return null;

  const { data, error } = await supabase.storage
    .from("documents")
    .download(template.storage_path);

  if (error || !data) {
    console.error("[template-manager] Storage 다운로드 실패:", error?.message);
    return null;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 로컬 data/programs/ 에서 HWPX 파일 로드
 * programs 테이블에서 source, source_id를 조회하여 경로 결정
 */
async function loadFromLocal(
  supabase: SupabaseClient,
  programId: string
): Promise<Buffer | null> {
  // Vercel 환경에서는 로컬 파일시스템 접근 불가 → 스킵
  if (process.env.VERCEL) return null;

  try {
    // programs 테이블에서 source, source_id 조회
    const { data: program } = await supabase
      .from("programs")
      .select("source, source_id")
      .eq("id", programId)
      .single();

    if (!program) return null;

    // dynamic import로 분리 → Turbopack 정적 파일 패턴 스캔 방지
    const { join, sep } = await import("path");
    const programsDir = ["data", "pro" + "grams"].join(sep);
    const programDir = join(
      process.cwd(),
      programsDir,
      program.source,
      program.source_id
    );

    if (!existsSync(programDir)) return null;

    // .hwpx 파일 찾기
    const files = readdirSync(programDir);
    const hwpxFile = files.find((f) => f.toLowerCase().endsWith(".hwpx"));

    if (hwpxFile) {
      const filePath = join(programDir, hwpxFile);
      return readFileSync(filePath);
    }

    // HWPX 없으면 HWP → 변환 시도
    const hwpFile = files.find((f) =>
      f.toLowerCase().endsWith(".hwp") && !f.toLowerCase().endsWith(".hwpx")
    );

    if (hwpFile && isHwpConverterAvailable()) {
      const hwpPath = join(programDir, hwpFile);
      const convertedBuffer = await convertHwpToHwpx(hwpPath);
      if (convertedBuffer) {
        return convertedBuffer;
      }
    }

    return null;
  } catch (err) {
    console.warn("[template-manager] 로컬 파일 로드 실패:", err);
    return null;
  }
}

/**
 * HWP 바이너리를 HWPX로 변환 시도
 * LibreOffice를 사용하여 HWP → DOCX로 변환 (HWPX 직접 변환 불가)
 * 실제로는 DOCX를 반환하지만 ZIP 기반이므로 일부 호환됨
 */
async function tryConvertHwp(
  hwpBuffer: Buffer,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _programId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _supabase: SupabaseClient
): Promise<Buffer | null> {
  const { tmpdir } = await import("os");
  const { writeFileSync: writeTmp, unlinkSync } = await import("fs");
  const { join: pathJoin } = await import("path");
  const tmpPath = pathJoin(tmpdir(), `hwp-input-${Date.now()}.hwp`);

  try {
    // 임시 파일로 저장
    writeTmp(tmpPath, hwpBuffer);

    // HWP → DOCX 변환 (HWPX 직접은 안 됨)
    const converted = await convertHwpToHwpx(tmpPath);

    // 임시 파일 정리
    try { unlinkSync(tmpPath); } catch { /* ignore */ }

    return converted;
  } catch (error) {
    console.error("[template-manager] HWP 변환 실패:", error);
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return null;
  }
}
