/**
 * 벡터 유사도 검색 모듈
 * 쿼리 임베딩 → Supabase RPC match_reference_chunks 호출
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { embedText } from "./embeddings";

export interface SearchResult {
  id: string;
  documentId: string;
  content: string;
  sectionName: string | null;
  chunkIndex: number;
  templateType: string | null;
  referenceType: string;
  similarity: number;
}

export interface SearchOptions {
  query: string;
  templateType?: string;
  referenceType?: string;
  topK?: number;
  threshold?: number;
}

/**
 * 레퍼런스 벡터 검색
 */
export async function searchReferences(
  opts: SearchOptions
): Promise<SearchResult[]> {
  const {
    query,
    templateType,
    referenceType = "business_plan",
    topK = 3,
    threshold = 0.3,
  } = opts;

  // 쿼리 임베딩
  const queryEmbedding = await embedText(query);

  // Supabase RPC 호출
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("match_reference_chunks", {
    query_embedding: JSON.stringify(queryEmbedding),
    match_count: topK,
    match_threshold: threshold,
    filter_template_type: templateType || null,
    filter_reference_type: referenceType || null,
  });

  if (error) {
    console.error("[RAG] 벡터 검색 실패:", error);
    return [];
  }

  return (data || []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    documentId: row.document_id as string,
    content: row.content as string,
    sectionName: (row.section_name as string) || null,
    chunkIndex: row.chunk_index as number,
    templateType: (row.template_type as string) || null,
    referenceType: row.reference_type as string,
    similarity: row.similarity as number,
  }));
}

/**
 * 검색 결과를 프롬프트에 주입할 텍스트로 포맷
 */
export function formatReferenceExamples(results: SearchResult[]): string {
  if (results.length === 0) return "";

  return results
    .map(
      (r, i) =>
        `### 레퍼런스 ${i + 1} (유사도: ${Math.round(r.similarity * 100)}%)${r.sectionName ? ` [${r.sectionName}]` : ""}\n${r.content}`
    )
    .join("\n\n");
}
