import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";

/**
 * POST /api/documents/extract
 * 업로드된 서류에서 AI(Claude)로 핵심 데이터 추출
 * - PDF/이미지 → Base64 → Claude Vision으로 OCR + 데이터 추출
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { documentId } = body;

  if (!documentId) {
    return Response.json(
      { error: "documentId가 필요합니다" },
      { status: 400 }
    );
  }

  // 문서 조회
  const { data: doc, error: docError } = await supabase
    .from("company_documents")
    .select("*, companies!inner(user_id)")
    .eq("id", documentId)
    .single();

  if (docError || !doc) {
    return Response.json({ error: "문서를 찾을 수 없습니다" }, { status: 404 });
  }

  // 권한 확인
  if ((doc as any).companies?.user_id !== user.id) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  if (!doc.file_url) {
    return Response.json(
      { error: "파일이 업로드되지 않았습니다" },
      { status: 400 }
    );
  }

  // 상태 업데이트: processing
  await supabase
    .from("company_documents")
    .update({ status: "processing" })
    .eq("id", documentId);

  try {
    // 파일 다운로드 (URL에서)
    const fileResponse = await fetch(doc.file_url);
    if (!fileResponse.ok) {
      throw new Error("파일 다운로드 실패");
    }

    const arrayBuffer = await fileResponse.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // MIME type 추출
    const contentType =
      fileResponse.headers.get("content-type") || "application/pdf";
    const isImage = contentType.startsWith("image/");
    const mediaType = isImage ? contentType : "application/pdf";

    // Claude로 OCR + 데이터 추출
    const extractionPrompt = getExtractionPrompt(doc.document_type);

    const result = await callClaudeVision({
      base64,
      mediaType: mediaType as
        | "image/png"
        | "image/jpeg"
        | "image/webp"
        | "image/gif",
      documentType: doc.document_type,
      prompt: extractionPrompt,
    });

    // JSON 파싱
    let extractedData: Record<string, any> = {};
    try {
      const jsonMatch = result.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (jsonMatch) {
        extractedData = JSON.parse(jsonMatch[1].trim());
      } else {
        const firstBrace = result.indexOf("{");
        const lastBrace = result.lastIndexOf("}");
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          extractedData = JSON.parse(
            result.substring(firstBrace, lastBrace + 1)
          );
        }
      }
    } catch {
      console.error("[Extract] JSON parsing failed, using raw text");
      extractedData = { raw_text: result, parse_error: true };
    }

    // 추출 결과 저장
    const { data: updated, error: updateError } = await supabase
      .from("company_documents")
      .update({
        extracted_data: extractedData,
        status: "extracted",
      })
      .eq("id", documentId)
      .select()
      .single();

    if (updateError) throw updateError;

    // 추출된 데이터를 companies 테이블에 반영
    await applyExtractedData(supabase, doc.company_id, doc.document_type, extractedData);

    return Response.json({
      document: updated,
      extractedData,
    });
  } catch (error) {
    console.error("[Extract] Error:", error);

    // 상태를 error로 변경
    await supabase
      .from("company_documents")
      .update({ status: "error" })
      .eq("id", documentId);

    return Response.json(
      { error: `데이터 추출 실패: ${String(error)}` },
      { status: 500 }
    );
  }
}

/**
 * Claude Vision API 호출 (이미지/PDF 분석)
 */
async function callClaudeVision({
  base64,
  mediaType,
  documentType,
  prompt,
}: {
  base64: string;
  mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
  documentType: string;
  prompt: string;
}): Promise<string> {
  // Anthropic SDK 직접 사용 (Vision API)
  const { anthropic } = await import("@/lib/ai/claude");

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: mediaType,
              data: base64,
            },
          },
          {
            type: "text",
            text: prompt,
          },
        ],
      },
    ],
    temperature: 0.1,
  });

  const textBlock = response.content.find(
    (block: any) => block.type === "text"
  ) as { type: "text"; text: string } | undefined;
  return textBlock?.text ?? "";
}

/**
 * 문서 유형별 추출 프롬프트
 */
function getExtractionPrompt(documentType: string): string {
  const prompts: Record<string, string> = {
    // 홈택스
    tax_clearance: `이 이미지는 국세완납증명서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "issue_date": "발급일 (YYYY-MM-DD)",
  "clearance_status": "완납 여부 (true/false)",
  "tax_office": "세무서"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    biz_registration: `이 이미지는 사업자등록증명입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "business_type": "업태",
  "business_item": "종목",
  "address": "사업장 소재지",
  "registration_date": "등록일 (YYYY-MM-DD)",
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    tax_payment: `이 이미지는 납부내역증명(납세사실증명)입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "tax_items": [{"tax_type": "세목", "period": "과세기간", "amount": 납부금액(숫자)}],
  "total_amount": 총납부금액(숫자),
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    vat_certificate: `이 이미지는 부가가치세 과세표준증명원입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "periods": [
    {
      "period": "과세기간 (예: 2024년 1기)",
      "sales_amount": 매출액(숫자),
      "tax_base": 과세표준(숫자)
    }
  ],
  "total_sales": 총매출액(숫자),
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    financial_statement: `이 이미지는 표준재무제표증명입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "fiscal_year": "사업연도",
  "revenue": 매출액(숫자),
  "operating_profit": 영업이익(숫자),
  "net_income": 당기순이익(숫자),
  "total_assets": 자산총계(숫자),
  "total_liabilities": 부채총계(숫자),
  "total_equity": 자본총계(숫자),
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    // 중소벤처24
    venture_cert: `이 이미지는 벤처기업확인서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "기업명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "venture_type": "벤처유형 (기술보증/연구개발/벤처투자 등)",
  "certification_date": "확인일 (YYYY-MM-DD)",
  "expiry_date": "유효기간 (YYYY-MM-DD)",
  "is_valid": true
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    sme_cert: `이 이미지는 중소기업(소상공인)확인서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "기업명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "company_size": "기업규모 (중소기업/소상공인)",
  "industry": "업종",
  "employee_count": 상시근로자수(숫자),
  "revenue": 매출액(숫자),
  "certification_date": "확인일 (YYYY-MM-DD)",
  "expiry_date": "유효기간 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    women_cert: `이 이미지는 여성기업확인서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "기업명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "certification_date": "확인일 (YYYY-MM-DD)",
  "expiry_date": "유효기간 (YYYY-MM-DD)",
  "is_valid": true
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    startup_cert: `이 이미지는 창업기업확인서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "기업명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "establishment_date": "설립일 (YYYY-MM-DD)",
  "startup_years": 창업연차(숫자),
  "certification_date": "확인일 (YYYY-MM-DD)",
  "expiry_date": "유효기간 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    // 사회보험
    insurance_clearance: `이 이미지는 4대보험 완납증명서입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "사업장명",
  "business_number": "사업자등록번호",
  "representative": "대표자",
  "clearance_status": "완납 여부 (true/false)",
  "insurance_types": ["국민연금", "건강보험", "고용보험", "산재보험"],
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,

    insurance_members: `이 이미지는 4대보험 가입자명부입니다.
다음 정보를 JSON으로 추출해주세요:
{
  "business_name": "사업장명",
  "business_number": "사업자등록번호",
  "total_employees": 총가입자수(숫자),
  "members": [
    {"name": "이름", "join_date": "취득일 (YYYY-MM-DD)", "insurance_type": "보험종류"}
  ],
  "issue_date": "발급일 (YYYY-MM-DD)"
}
가입자 목록은 최대 20명까지만 추출하세요.
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`,
  };

  return (
    prompts[documentType] ||
    `이 문서의 핵심 정보를 JSON으로 추출해주세요.
{
  "document_title": "문서 제목",
  "business_name": "상호/법인명",
  "business_number": "사업자등록번호",
  "key_data": {},
  "issue_date": "발급일 (YYYY-MM-DD)"
}
반드시 JSON만 응답하세요. 읽을 수 없는 필드는 null로 하세요.`
  );
}

/**
 * 추출된 데이터를 companies 테이블에 반영
 */
async function applyExtractedData(
  supabase: any,
  companyId: string,
  documentType: string,
  data: Record<string, any>
) {
  try {
    const updates: Record<string, any> = {};

    switch (documentType) {
      case "financial_statement":
        if (data.revenue) updates.revenue = String(data.revenue);
        break;
      case "sme_cert":
        if (data.employee_count) updates.employee_count = data.employee_count;
        if (data.industry) updates.industry = data.industry;
        if (data.revenue) updates.revenue = String(data.revenue);
        break;
      case "biz_registration":
        if (data.business_type) updates.industry = data.business_type;
        if (data.registration_date)
          updates.established_date = data.registration_date;
        break;
      case "insurance_members":
        if (data.total_employees)
          updates.employee_count = data.total_employees;
        break;
    }

    if (Object.keys(updates).length > 0) {
      updates.updated_at = new Date().toISOString();
      await supabase
        .from("companies")
        .update(updates)
        .eq("id", companyId);
    }
  } catch (error) {
    console.error("[Extract] Failed to apply data to company:", error);
  }
}
