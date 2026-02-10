/**
 * 사업자등록증 OCR API
 * POST: 이미지/PDF 업로드 → Claude Vision OCR → 기업정보 자동 추출
 */

import { createClient } from "@/lib/supabase/server";
import { anthropic } from "@/lib/ai/claude";

const OCR_SYSTEM = `당신은 대한민국 사업자등록증 OCR 전문가입니다.
이미지에서 사업자등록증 정보를 정확히 추출하세요.

반드시 아래 JSON 형식으로만 출력하세요:
\`\`\`json
{
  "company_name": "회사명 (상호)",
  "representative": "대표자명",
  "business_number": "사업자등록번호 (000-00-00000)",
  "industry": "업태",
  "business_type": "종목",
  "address": "사업장 소재지",
  "established_date": "YYYY-MM-DD (개업연월일)",
  "corporate_number": "법인등록번호 (있으면)",
  "confidence": 0.95
}
\`\`\`

- 읽을 수 없는 항목은 null로 표시
- 날짜는 반드시 YYYY-MM-DD 형식
- 사업자등록번호는 하이픈 포함 (000-00-00000)
- confidence는 전체 추출 신뢰도 (0~1)
- JSON만 출력하세요`;

interface OcrResult {
  company_name: string | null;
  representative: string | null;
  business_number: string | null;
  industry: string | null;
  business_type: string | null;
  address: string | null;
  established_date: string | null;
  corporate_number: string | null;
  confidence: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const autoSave = formData.get("autoSave") === "true";

    if (!file) {
      return Response.json({ error: "파일이 필요합니다" }, { status: 400 });
    }

    // 파일 유효성 검사
    const validTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
      "application/pdf",
    ];
    if (!validTypes.includes(file.type)) {
      return Response.json(
        { error: "지원하지 않는 파일 형식입니다 (JPG, PNG, WebP, GIF, PDF)" },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return Response.json(
        { error: "파일 크기는 10MB 이하여야 합니다" },
        { status: 400 }
      );
    }

    // 파일을 base64로 변환
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    // Claude Vision API 호출
    const mediaType = file.type === "application/pdf"
      ? "application/pdf" as const
      : file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    const contentBlock = file.type === "application/pdf"
      ? {
          type: "document" as const,
          source: {
            type: "base64" as const,
            media_type: "application/pdf" as const,
            data: base64,
          },
        }
      : {
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
            data: base64,
          },
        };

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: OCR_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            contentBlock as any,
            {
              type: "text",
              text: "이 사업자등록증의 정보를 추출해주세요.",
            },
          ],
        },
      ],
      temperature: 0,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text ?? "";

    // JSON 파싱
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json(
        { error: "OCR 결과를 파싱할 수 없습니다", raw: rawText },
        { status: 422 }
      );
    }

    const ocrResult: OcrResult = JSON.parse(jsonMatch[0]);

    // 지역 추출 (주소에서)
    let region: string | null = null;
    if (ocrResult.address) {
      const regionMatch = ocrResult.address.match(
        /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/
      );
      region = regionMatch ? regionMatch[1] : null;
    }

    // autoSave가 true이면 companies 테이블 자동 업데이트
    if (autoSave) {
      const { data: company } = await supabase
        .from("companies")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (company) {
        const updates: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (ocrResult.company_name) updates.name = ocrResult.company_name;
        if (ocrResult.industry) updates.industry = ocrResult.industry;
        if (ocrResult.established_date) updates.established_date = ocrResult.established_date;
        if (region) updates.region = region;

        await supabase.from("companies").update(updates).eq("id", company.id);
      }
    }

    return Response.json({
      success: true,
      data: {
        ...ocrResult,
        region,
      },
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (error) {
    console.error("[OCR] 사업자등록증 OCR 실패:", error);
    return Response.json(
      { error: "OCR 처리 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
