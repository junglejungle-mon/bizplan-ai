import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { streamClaude } from "@/lib/ai/claude";
import {
  ASSISTANT_SYSTEM,
  buildAssistantPrompt,
} from "@/lib/ai/prompts/assistant";
import { searchReferences, formatReferenceExamples } from "@/lib/rag/search";
import { safeErrorMessage } from "@/lib/api/error";

/**
 * POST /api/assistant/chat
 * AI 비서 채팅 (SSE 스트리밍)
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { message, contextType, contextId } = await request.json();

  if (!message) {
    return Response.json({ error: "message required" }, { status: 400 });
  }

  // 회사 프로필 로드
  const { data: companies } = await supabase
    .from("companies")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  const company = companies?.[0];
  const companyProfile = company?.business_content || undefined;

  // 컨텍스트 로드
  let currentContext: { type: "program" | "plan" | "general" | "ir"; title: string; details: string } | undefined = undefined;
  if (contextType && contextId) {
    if (contextType === "program") {
      const { data: program } = await supabase
        .from("programs")
        .select("title, summary, target")
        .eq("id", contextId)
        .single();
      if (program) {
        currentContext = {
          type: "program",
          title: program.title,
          details: `${program.summary || ""}\n대상: ${program.target || ""}`,
        };
      }
    } else if (contextType === "plan") {
      const { data: plan } = await supabase
        .from("business_plans")
        .select("title, status")
        .eq("id", contextId)
        .single();
      if (plan) {
        currentContext = {
          type: "plan",
          title: plan.title,
          details: `상태: ${plan.status}`,
        };
      }
    }
  }

  // 이전 대화 히스토리 로드 (최근 10건)
  const { data: history } = await supabase
    .from("assistant_chats")
    .select("role, content")
    .eq("company_id", company?.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const previousMessages = (history ?? [])
    .reverse()
    .map((h: { role: string; content: string }) => ({
      role: h.role as "user" | "assistant",
      content: h.content,
    }));

  // 서류 업로드 현황 (서류 유도 컨텍스트용)
  let documentStatus: {
    totalCount: number;
    extractedCount: number;
    types: string[];
    profileScore: number;
  } | undefined;

  if (company) {
    const { data: docs } = await supabase
      .from("company_documents")
      .select("document_type, status")
      .eq("company_id", company.id);

    type DocRow = { document_type: string; status: string };
    const extracted = (docs ?? []).filter((d: DocRow) => d.status === "extracted");
    documentStatus = {
      totalCount: (docs ?? []).length,
      extractedCount: extracted.length,
      types: extracted.map((d: DocRow) => d.document_type),
      profileScore: company.profile_score || 0,
    };
  }

  // 사용자 메시지 저장
  if (company) {
    await supabase.from("assistant_chats").insert({
      company_id: company.id,
      role: "user",
      content: message,
      context_type: contextType || "general",
      context_id: contextId || null,
    });
  }

  // RAG 검색 (사업계획서 관련 질문일 때)
  let ragContext: string | undefined;
  try {
    const ragResults = await searchReferences({
      query: message,
      topK: 3,
      threshold: 0.3,
    });
    if (ragResults.length > 0) {
      ragContext = formatReferenceExamples(ragResults);
    }
  } catch (e) {
    console.warn("[Assistant] RAG 검색 실패 (무시):", e);
  }

  // SSE 스트리밍 응답
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let fullResponse = "";

        const prompt = buildAssistantPrompt({
          userMessage: message,
          companyProfile,
          currentContext,
          ragContext,
          documentStatus,
        });

        for await (const chunk of streamClaude({
          model: "claude-haiku-4-5-20251001",
          system: ASSISTANT_SYSTEM,
          messages: [
            ...previousMessages,
            { role: "user", content: prompt },
          ],
          temperature: 0.6,
          maxTokens: 1000,
        })) {
          fullResponse += chunk;
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "chunk", text: chunk })}\n\n`
            )
          );
        }

        // 응답 저장
        if (company) {
          await supabase.from("assistant_chats").insert({
            company_id: company.id,
            role: "assistant",
            content: fullResponse,
            context_type: contextType || "general",
            context_id: contextId || null,
          });
        }

        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "done", content: fullResponse })}\n\n`
          )
        );
        controller.close();
      } catch (error) {
        console.error("[Assistant] Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message: safeErrorMessage(error, "AI 응답 처리 중 오류가 발생했습니다") })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
