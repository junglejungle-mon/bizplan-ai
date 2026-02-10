/**
 * 레퍼런스 문서 처리 파이프라인
 * PDF 다운로드 → Claude OCR → 청킹 → 배치 임베딩 → DB 저장
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { anthropic } from "@/lib/ai/claude";
import { PROGRAM_PDF_OCR_SYSTEM } from "@/lib/ai/prompts/writing";
import { chunkDocument } from "./chunker";
import { embedBatch } from "./embeddings";

export interface ProcessingEvent {
  step: string;
  progress: number;
  detail?: string;
}

/**
 * 레퍼런스 문서 처리 (AsyncGenerator로 진행률 반환)
 */
export async function* processReferenceDocument(
  documentId: string
): AsyncGenerator<ProcessingEvent> {
  const supabase = createAdminClient();

  try {
    // 1. 문서 로드
    const { data: doc, error } = await supabase
      .from("reference_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (error || !doc) {
      throw new Error("문서를 찾을 수 없습니다");
    }

    // 상태 → processing
    await supabase
      .from("reference_documents")
      .update({ status: "processing", updated_at: new Date().toISOString() })
      .eq("id", documentId);

    yield { step: "문서 로드 완료", progress: 5 };

    // 2. 기존 청크 삭제 (재처리 시)
    await supabase
      .from("reference_chunks")
      .delete()
      .eq("document_id", documentId);

    yield { step: "기존 청크 정리", progress: 10 };

    // 3. PDF OCR (Storage에서 다운로드)
    let ocrText = doc.ocr_text;

    if (!ocrText && doc.file_url) {
      yield { step: "PDF OCR 처리 중...", progress: 15 };

      const { data: fileData } = await supabase.storage
        .from("references")
        .download(doc.file_url);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const base64 = buffer.toString("base64");

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
                  text: "이 PDF의 전체 내용을 추출해주세요. 섹션 구조를 유지하고 표 데이터를 포함해주세요.",
                },
              ],
            },
          ],
          temperature: 0,
        });

        const textBlock = response.content.find((b) => b.type === "text") as
          | { type: "text"; text: string }
          | undefined;
        ocrText = textBlock?.text ?? "";

        // OCR 텍스트 저장
        await supabase
          .from("reference_documents")
          .update({ ocr_text: ocrText })
          .eq("id", documentId);
      }

      yield {
        step: `OCR 완료 (${ocrText?.length || 0}자)`,
        progress: 40,
      };
    } else {
      yield { step: "OCR 텍스트 재사용", progress: 40 };
    }

    if (!ocrText || ocrText.length < 100) {
      throw new Error("OCR 텍스트가 너무 짧습니다");
    }

    // 4. 청킹
    yield { step: "문서 청킹 중...", progress: 50 };
    const chunks = chunkDocument(ocrText);

    yield {
      step: `${chunks.length}개 청크 생성`,
      progress: 55,
      detail: `평균 ${Math.round(ocrText.length / chunks.length)}자/청크`,
    };

    // 5. 배치 임베딩
    yield { step: "임베딩 생성 중...", progress: 60 };
    const texts = chunks.map((c) => c.content);
    const embeddings = await embedBatch(texts);

    yield { step: `${embeddings.length}개 임베딩 완료`, progress: 80 };

    // 6. DB 저장
    yield { step: "DB 저장 중...", progress: 85 };

    const chunkRows = chunks.map((chunk, i) => ({
      document_id: documentId,
      content: chunk.content,
      section_name: chunk.sectionName,
      chunk_index: chunk.chunkIndex,
      embedding: JSON.stringify(embeddings[i]),
      token_count: Math.ceil(chunk.content.length / 3),
      template_type: doc.template_type,
      reference_type: doc.reference_type,
    }));

    // 50개씩 배치 삽입
    for (let i = 0; i < chunkRows.length; i += 50) {
      const batch = chunkRows.slice(i, i + 50);
      const { error: insertError } = await supabase
        .from("reference_chunks")
        .insert(batch);

      if (insertError) {
        console.error("[RAG] 청크 삽입 실패:", insertError);
        throw new Error(`청크 저장 실패: ${insertError.message}`);
      }
    }

    // 7. 문서 상태 업데이트
    await supabase
      .from("reference_documents")
      .update({
        status: "completed",
        chunk_count: chunks.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    yield {
      step: "처리 완료",
      progress: 100,
      detail: `${chunks.length}개 청크, ${embeddings.length}개 임베딩`,
    };
  } catch (error) {
    // 실패 상태 업데이트
    await supabase
      .from("reference_documents")
      .update({
        status: "failed",
        metadata: { error: String(error) },
        updated_at: new Date().toISOString(),
      })
      .eq("id", documentId);

    throw error;
  }
}
