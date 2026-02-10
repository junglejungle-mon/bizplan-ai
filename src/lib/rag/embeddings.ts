/**
 * OpenAI 임베딩 클라이언트
 * text-embedding-3-small (1536차원) 사용
 */

import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const EMBEDDING_MODEL = "text-embedding-3-small";
const BATCH_SIZE = 100;

/**
 * 단일 텍스트 임베딩 (검색 시 사용)
 */
export async function embedText(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " ").trim(),
  });
  return response.data[0].embedding;
}

/**
 * 벌크 임베딩 (처리 시 사용, 100개씩 배치)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE).map((t) =>
      t.replace(/\n/g, " ").trim()
    );

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });

    const batchEmbeddings = response.data
      .sort((a, b) => a.index - b.index)
      .map((d) => d.embedding);

    allEmbeddings.push(...batchEmbeddings);
  }

  return allEmbeddings;
}
