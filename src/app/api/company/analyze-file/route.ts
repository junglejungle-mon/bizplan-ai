import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeVision } from "@/lib/ai/claude";
import { calculateProfileScore } from "@/lib/utils/profile-score";
import { validateFileSignature } from "@/lib/utils/file-signature";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

/**
 * POST /api/company/analyze-file
 * 회사 관련 파일(회사소개서, 사업계획서, 기타 자료) 업로드 → AI 분석 → 정리된 데이터 반환
 * - 파일을 Supabase Storage에 저장
 * - Claude Vision으로 내용 분석 및 핵심 데이터 추출
 * - 추출된 데이터를 company_documents에 저장
 */
export async function POST(request: NextRequest) {
  // Rate limiting (AI 파일 분석 엔드포인트)
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`analyze-file:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: companies } = await supabase
    .from("companies")
    .select("id, name, business_content, industry, region, employee_count, revenue, established_date, profile_score")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  if (!company) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  // FormData 파싱
  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const fileType = (formData.get("fileType") as string) || "company_intro"; // company_intro, business_plan, financial, other

  if (!file) {
    return Response.json({ error: "파일이 필요합니다" }, { status: 400 });
  }

  // 파일 크기 제한 (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return Response.json(
      { error: "파일 크기는 10MB 이하여야 합니다" },
      { status: 400 }
    );
  }

  // 허용된 파일 유형
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
  ];
  if (!allowedTypes.includes(file.type)) {
    return Response.json(
      { error: "PDF, PNG, JPG, WebP 파일만 업로드 가능합니다" },
      { status: 400 }
    );
  }

  try {
    // 1. Supabase Storage에 파일 업로드
    const admin = createAdminClient();
    const fileExt = file.name.split(".").pop() || "pdf";
    const fileName = `${company.id}/analyzed_${fileType}_${Date.now()}.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // 매직 바이트 검증 (MIME 타입 스푸핑 방지)
    if (!validateFileSignature(buffer, file.type)) {
      return Response.json(
        { error: "파일 내용이 선언된 형식과 일치하지 않습니다" },
        { status: 400 }
      );
    }

    const { error: uploadError } = await admin.storage
      .from("documents")
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[AnalyzeFile] Storage upload error:", uploadError);
      return Response.json(
        { error: "파일 업로드에 실패했습니다" },
        { status: 500 }
      );
    }

    const {
      data: { publicUrl },
    } = admin.storage.from("documents").getPublicUrl(fileName);

    // 2. 파일을 Base64로 변환하여 Claude Vision에 전달
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mediaType = file.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "application/pdf";

    // 파일 유형별 분석 프롬프트
    const FILE_TYPE_PROMPTS: Record<string, string> = {
      company_intro: `이 회사소개서를 분석하여 다음 정보를 추출하세요:
1. 회사 개요 (설립일, 직원수, 매출 등)
2. 주요 사업 분야 및 제품/서비스
3. 핵심 역량 및 경쟁력
4. 주요 실적 및 수상 이력
5. 파트너십 및 고객사
6. 기술 스택 또는 특허/인증
7. 비전 및 성장 전략`,

      business_plan: `이 사업계획서를 분석하여 다음 정보를 추출하세요:
1. 사업 목적 및 핵심 가치제안
2. 시장 분석 (타겟 시장, 규모, 성장률)
3. 비즈니스 모델 및 수익 구조
4. 경쟁 분석 및 차별화 전략
5. 재무 계획 (매출 전망, 투자 계획)
6. 핵심 마일스톤 및 로드맵
7. 팀 구성 및 역량`,

      financial: `이 재무 자료를 분석하여 다음 정보를 추출하세요:
1. 매출 현황 (연도별)
2. 영업이익 및 순이익
3. 주요 비용 구조
4. 자산 및 부채 현황
5. 현금 흐름
6. 주요 재무 지표 (성장률, 이익률 등)`,

      other: `이 자료를 분석하여 다음 정보를 추출하세요:
1. 자료의 주요 내용 요약
2. 핵심 데이터 포인트 (수치, 통계)
3. 사업에 활용 가능한 정보
4. 주요 인사이트`,
    };

    const analysisPrompt = FILE_TYPE_PROMPTS[fileType] || FILE_TYPE_PROMPTS.other;

    const result = await callClaudeVision({
      model: "claude-sonnet-4-20250514",
      system: `당신은 비즈니스 자료 분석 전문가입니다.
업로드된 자료를 꼼꼼히 분석하여 체계적으로 정리해주세요.

반드시 다음 JSON 형식으로 응답하세요:
{
  "summary": "한 줄 요약 (50자 이내)",
  "category": "자료 카테고리",
  "key_data": [
    {"label": "항목명", "value": "값"},
    ...
  ],
  "insights": ["인사이트1", "인사이트2", ...],
  "full_analysis": "상세 분석 내용 (마크다운 형식, 구조화된 내용)",
  "applicable_fields": {
    "industry": "추출된 업종 (있는 경우)",
    "revenue": "추출된 매출 (있는 경우)",
    "employee_count": "추출된 직원수 (있는 경우, 숫자만)",
    "established_date": "추출된 설립일 (있는 경우, YYYY-MM-DD)",
    "business_content_addition": "기존 사업 프로필에 추가할 내용"
  }
}`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: mediaType === "application/pdf" ? "image/png" : mediaType,
                data: base64,
              },
            },
            {
              type: "text" as const,
              text: `회사명: ${company.name || "미입력"}
기존 업종: ${company.industry || "미입력"}

${analysisPrompt}

반드시 JSON 형식으로만 응답해주세요.`,
            },
          ],
        },
      ],
      maxTokens: 4096,
      temperature: 0.3,
    });

    // JSON 파싱 시도
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI-extracted dynamic JSON structure
    let parsedResult: Record<string, any> | null = null;
    try {
      // JSON 블록 추출
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0]);
      }
    } catch {
      // JSON 파싱 실패 시 텍스트로 저장
      parsedResult = {
        summary: "파일 분석 완료",
        full_analysis: result,
        key_data: [],
        insights: [],
        applicable_fields: {},
      };
    }

    // 3. company_documents에 저장 (admin 클라이언트로 RLS 우회)
    const { data: doc, error: docError } = await admin
      .from("company_documents")
      .insert({
        company_id: company.id,
        document_type: `analyzed_${fileType}`,
        source: "file_analysis",
        file_url: publicUrl,
        status: "extracted",
        extracted_data: parsedResult,
      })
      .select()
      .single();

    if (docError) {
      console.error("[AnalyzeFile] DB insert error:", docError);
    }

    // 4. applicable_fields가 있으면 회사 정보에 자동 반영
    const applicableFields = parsedResult?.applicable_fields;
    let autoUpdated = false;

    if (applicableFields && typeof applicableFields === "object") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {};

      // 기존에 비어있는 필드만 채우기 (이미 입력된 데이터는 덮어쓰지 않음)
      if (applicableFields.industry && !company.industry) {
        updateData.industry = applicableFields.industry;
      }
      if (applicableFields.revenue) {
        updateData.revenue = applicableFields.revenue;
      }
      if (applicableFields.employee_count) {
        const empCount = parseInt(applicableFields.employee_count);
        if (!isNaN(empCount) && empCount > 0) {
          updateData.employee_count = empCount;
        }
      }
      if (applicableFields.established_date) {
        updateData.established_date = applicableFields.established_date;
      }
      // business_content_addition은 기존 내용에 추가
      if (applicableFields.business_content_addition) {
        const existingContent = company.business_content || "";
        const addition = applicableFields.business_content_addition;
        if (addition && !existingContent.includes(addition.slice(0, 50))) {
          updateData.business_content = existingContent
            ? `${existingContent}\n\n[파일 분석 추가 정보]\n${addition}`
            : addition;
        }
      }

      if (Object.keys(updateData).length > 0) {
        // 인터뷰 답변 수 조회 (프로필 점수 계산용)
        const { data: interviews } = await admin
          .from("company_interviews")
          .select("id")
          .eq("company_id", company.id)
          .not("answer", "is", null);
        const answeredCount = interviews?.length || 0;

        // 업데이트된 데이터와 기존 데이터를 합쳐서 점수 계산
        const mergedCompany = { ...company, ...updateData };
        const newScore = calculateProfileScore(mergedCompany, answeredCount);

        updateData.profile_score = newScore;
        updateData.updated_at = new Date().toISOString();

        const { error: updateError } = await admin
          .from("companies")
          .update(updateData)
          .eq("id", company.id);

        if (updateError) {
          console.error("[AnalyzeFile] Company auto-update error:", updateError);
        } else {
          autoUpdated = true;
        }
      }
    }

    return Response.json({
      success: true,
      analysis: parsedResult,
      documentId: doc?.id,
      fileUrl: publicUrl,
      autoUpdated,
    });
  } catch (error) {
    console.error("[AnalyzeFile] Error:", error);
    return Response.json(
      { error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
