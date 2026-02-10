/**
 * 공고 양식 PDF → OCR 텍스트 변환 유틸리티
 * - programs.attachment_urls에서 PDF URL 추출
 * - PDF 다운로드 + base64 변환
 * - Claude DocumentBlockParam으로 OCR
 */

import { anthropic } from "@/lib/ai/claude";
import { PROGRAM_PDF_OCR_SYSTEM } from "@/lib/ai/prompts/writing";

/**
 * attachment_urls JSONB에서 PDF URL 추출
 * Bizinfo: {pdf: "url", file: "url"} → file 우선 (양식), pdf 폴백 (공고문)
 * MSS: {file: "url", fileName: "name"}
 * K-Startup: {} → null
 */
export function extractPdfUrlFromProgram(
  attachmentUrls: Record<string, any>
): string | null {
  if (!attachmentUrls || typeof attachmentUrls !== "object") return null;

  // 후보 URL 수집 (file 우선 → pdf 폴백)
  const candidates: string[] = [];
  if (attachmentUrls.file) candidates.push(String(attachmentUrls.file));
  if (attachmentUrls.pdf) candidates.push(String(attachmentUrls.pdf));

  for (const url of candidates) {
    if (!url || url.length < 10) continue;
    // PDF 확장자 또는 정부 사이트의 파일 다운로드 경로 허용
    const lower = url.toLowerCase();
    if (
      lower.endsWith(".pdf") ||
      lower.includes("/file/") ||
      lower.includes("download") ||
      lower.includes("filedown") ||
      lower.includes("printflpth")
    ) {
      return url;
    }
  }

  // 확장자 없는 URL이라도 존재하면 시도 (정부 사이트는 확장자 없는 경우 多)
  if (candidates.length > 0 && candidates[0].startsWith("http")) {
    return candidates[0];
  }

  return null;
}

/**
 * PDF URL에서 다운로드 후 base64 변환
 * 30초 타임아웃, 30MB 상한
 */
export async function downloadPdfAsBase64(
  url: string
): Promise<{ base64: string; sizeBytes: number } | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(`[OCR] PDF 다운로드 실패: ${response.status} ${url}`);
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const sizeBytes = arrayBuffer.byteLength;

    // 30MB 상한
    if (sizeBytes > 30 * 1024 * 1024) {
      console.warn(`[OCR] PDF 크기 초과: ${(sizeBytes / 1024 / 1024).toFixed(1)}MB`);
      return null;
    }

    // 최소 크기 체크 (빈 파일 방지)
    if (sizeBytes < 1000) {
      console.warn(`[OCR] PDF 크기 너무 작음: ${sizeBytes}bytes`);
      return null;
    }

    const base64 = Buffer.from(arrayBuffer).toString("base64");
    return { base64, sizeBytes };
  } catch (error) {
    console.error(`[OCR] PDF 다운로드 에러:`, error);
    return null;
  }
}

/**
 * Claude DocumentBlockParam으로 PDF OCR
 * 정부지원사업 양식에 특화된 추출
 */
export async function ocrProgramPdf(base64: string): Promise<string> {
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 16000,
    system: PROGRAM_PDF_OCR_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64,
            },
          },
          {
            type: "text",
            text: "이 PDF의 사업계획서 양식 전체 내용을 추출해주세요. 섹션 구조, 작성 지침, 평가 항목을 모두 포함하세요.",
          },
        ],
      },
    ],
    temperature: 0,
  });

  const textBlock = response.content.find(
    (block) => block.type === "text"
  ) as { type: "text"; text: string } | undefined;
  return textBlock?.text ?? "";
}
