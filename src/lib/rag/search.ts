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

/**
 * 하이브리드 검색: 벡터 유사도 + 키워드 매칭
 * 벡터 검색 결과에 키워드 부스팅을 적용하여 정확도 향상
 */
export async function hybridSearchReferences(
  opts: SearchOptions & { keywords?: string[] }
): Promise<SearchResult[]> {
  // 1. 벡터 유사도 검색 (기존)
  const vectorResults = await searchReferences({
    ...opts,
    topK: (opts.topK || 3) * 2, // 넉넉하게 가져와서 리랭킹
  });

  if (!opts.keywords || opts.keywords.length === 0) {
    return vectorResults.slice(0, opts.topK || 3);
  }

  // 2. 키워드 부스팅 - 키워드가 포함된 결과에 가산점
  const boostedResults = vectorResults.map((result) => {
    const keywordMatches = opts.keywords!.filter((kw) =>
      result.content.toLowerCase().includes(kw.toLowerCase())
    ).length;
    const boost = keywordMatches * 0.05; // 키워드 하나당 5% 부스트
    return {
      ...result,
      similarity: Math.min(1, result.similarity + boost),
    };
  });

  // 3. 부스팅된 점수로 재정렬
  boostedResults.sort((a, b) => b.similarity - a.similarity);

  return boostedResults.slice(0, opts.topK || 3);
}

/**
 * 메시지에서 핵심 키워드 추출 (간단한 한국어 키워드 추출)
 */
export function extractKeywords(message: string): string[] {
  // 불용어 제거 후 2글자 이상 단어 추출
  const stopWords = new Set([
    "그리고", "또한", "하지만", "그러나", "따라서", "이것", "저것", "그것",
    "우리", "나는", "이런", "저런", "어떤", "무엇", "어떻게", "왜",
    "있다", "없다", "하다", "되다", "이다", "않다", "수", "것", "등",
    "위해", "대해", "대한", "통해", "있는", "하는", "된", "할", "한",
    "좀", "주세요", "알려", "해주", "부탁", "감사",
  ]);

  return message
    .replace(/[^\w가-힣\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w))
    .slice(0, 5);
}
