import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import {
  extractPdfUrlFromProgram,
  downloadPdfAsBase64,
  ocrProgramPdf,
} from "@/lib/ocr/program-pdf-ocr";

export const maxDuration = 60;

/**
 * 공고 지침서 구조 추출 프롬프트
 * OCR 텍스트에서 섹션 구조 + 평가 기준 + 작성 요건을 JSON으로 추출
 */
const GUIDELINE_STRUCTURE_PROMPT = `아래는 정부지원사업 공고 양식(지침서/사업계획서 양식)의 OCR 텍스트입니다.
이 양식에서 **사업계획서에 작성해야 할 섹션 구조, 평가 기준, 작성 요건**을 JSON으로 추출하세요.

## 추출 항목

\`\`\`json
{
  "program_type": "일반과제형|R&D형|창업패키지형|바우처형|기타",
  "sections": [
    {
      "order": 1,
      "name": "섹션명 (예: 사업 개요, 기술 현황)",
      "sub_sections": ["하위 섹션명 리스트"],
      "guidelines": "작성 지침 요약 (원본의 핵심만)",
      "max_pages": null,
      "evaluation_weight": 0,
      "required_contents": ["반드시 포함해야 할 내용"],
      "evaluation_criteria": "이 섹션의 평가 기준 (원문에서 추출)"
    }
  ],
  "evaluation_table": [
    {
      "category": "평가 대분류",
      "items": [
        {
          "item": "평가 세부 항목",
          "weight": 0,
          "description": "평가 기준 설명"
        }
      ]
    }
  ],
  "total_pages": null,
  "submission_format": "HWP|DOCX|PDF|기타",
  "key_requirements": ["핵심 요구사항 Top 5"],
  "bonus_criteria": ["가산점 항목"],
  "disqualification_criteria": ["실격/감점 사유"]
}
\`\`\`

## 추출 원칙
1. 원본 양식의 섹션 순서를 그대로 유지
2. 평가 배점이 명시되어 있으면 정확하게 추출
3. 배점이 없으면 중요도 기반으로 추정 (총합 100)
4. "작성 지침"은 핵심만 간결하게 요약
5. 양식에 없는 내용은 추측하지 말 것 — null로 표시
6. 제출 형식(HWP/DOCX 등)이 명시되어 있으면 추출

JSON만 출력하세요.`;

/**
 * POST /api/programs/[id]/extract-guideline
 * 공고 첨부파일 OCR → 구조화된 지침서 추출 → DB 저장
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: programId } = await params;

  // 프로그램 정보 가져오기
  const adminClient = createAdminClient();
  const { data: program } = await adminClient
    .from("programs")
    .select("id, title, attachment_urls, raw_data")
    .eq("id", programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: "프로그램을 찾을 수 없습니다" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ProgramData = { id: string; title: string; attachment_urls?: Record<string, any> | null; raw_data?: Record<string, any> | null };
  const attachmentUrls = (program as ProgramData).attachment_urls;

  // 이미 추출된 구조가 있는지 확인 (raw_data.guideline_structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData: Record<string, any> = (program as ProgramData).raw_data || {};
  if (rawData.guideline_structure) {
    return NextResponse.json({
      success: true,
      cached: true,
      structure: rawData.guideline_structure,
    });
  }

  // PDF URL 추출
  const pdfUrl = extractPdfUrlFromProgram(attachmentUrls || {});
  if (!pdfUrl) {
    return NextResponse.json({
      error: "첨부 PDF를 찾을 수 없습니다",
      detail: "이 공고에는 양식 첨부파일이 없거나 지원되지 않는 형식입니다.",
    }, { status: 404 });
  }

  try {
    // Step 1: PDF 다운로드
    const pdfData = await downloadPdfAsBase64(pdfUrl);
    if (!pdfData) {
      return NextResponse.json({
        error: "PDF 다운로드 실패",
        detail: "첨부파일을 다운로드할 수 없습니다. URL이 만료되었을 수 있습니다.",
      }, { status: 502 });
    }

    // Step 2: OCR
    const ocrText = await ocrProgramPdf(pdfData.base64);
    if (!ocrText || ocrText.length < 100) {
      return NextResponse.json({
        error: "OCR 추출 실패",
        detail: "PDF에서 텍스트를 추출할 수 없습니다.",
      }, { status: 500 });
    }

    // Step 3: 구조 추출 (Claude)
    const structureJson = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: GUIDELINE_STRUCTURE_PROMPT,
      messages: [{
        role: "user",
        content: `OCR 텍스트 (${ocrText.length}자):\n\n${ocrText}`,
      }],
      temperature: 0.1,
      maxTokens: 8000,
    });

    // JSON 파싱
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let structure: Record<string, any> | null = null;
    try {
      const jsonMatch = structureJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        structure = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("[GuidelineExtract] JSON 파싱 실패:", parseError);
      return NextResponse.json({
        error: "구조 파싱 실패",
        detail: "지침서에서 구조를 추출했으나 파싱에 실패했습니다.",
        raw_text: ocrText.substring(0, 500),
      }, { status: 500 });
    }

    if (!structure) {
      return NextResponse.json({
        error: "구조 추출 실패",
        detail: "AI가 구조를 추출하지 못했습니다.",
      }, { status: 500 });
    }

    // Step 4: DB에 저장 (raw_data.guideline_structure에 캐시)
    const updatedRawData = {
      ...rawData,
      guideline_structure: structure,
      guideline_ocr_text: ocrText,
      guideline_extracted_at: new Date().toISOString(),
      guideline_pdf_url: pdfUrl,
      guideline_pdf_size: pdfData.sizeBytes,
    };

    await adminClient
      .from("programs")
      .update({ raw_data: updatedRawData })
      .eq("id", programId);

    return NextResponse.json({
      success: true,
      cached: false,
      structure,
      ocr_length: ocrText.length,
      pdf_size: pdfData.sizeBytes,
    });
  } catch (error) {
    console.error("[GuidelineExtract] 오류:", error);
    return NextResponse.json({
      error: "지침서 추출 중 오류",
      detail: "처리 중 오류가 발생했습니다",
    }, { status: 500 });
  }
}

/**
 * GET /api/programs/[id]/extract-guideline
 * 이미 추출된 구조 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: programId } = await params;

  const adminClient = createAdminClient();
  const { data: program } = await adminClient
    .from("programs")
    .select("id, title, raw_data")
    .eq("id", programId)
    .single();

  if (!program) {
    return NextResponse.json({ error: "프로그램을 찾을 수 없습니다" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawData: Record<string, any> = (program as { raw_data?: Record<string, any> | null }).raw_data || {};

  if (!rawData.guideline_structure) {
    return NextResponse.json({
      extracted: false,
      message: "아직 지침서 구조가 추출되지 않았습니다. POST로 추출해주세요.",
    });
  }

  return NextResponse.json({
    extracted: true,
    structure: rawData.guideline_structure,
    extracted_at: rawData.guideline_extracted_at,
    ocr_length: rawData.guideline_ocr_text?.length || 0,
  });
}
