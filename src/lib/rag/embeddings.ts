/**
 * OpenAI 임베딩 클라이언트
 * text-embedding-3-small (1536차원) 사용
 *
 * [2026-04-07 비용 차단]
 * OpenAI Embeddings API 호출이 비용 누수원으로 확인됨.
 * OPENAI_EMBEDDINGS_ENABLED=1 환경변수로 명시적으로 켤 때만 OpenAI 호출.
 * 기본은 deterministic hash embedding (1536차원, 결정적, 무료).
 *
 * 부작용: hash embedding은 시맨틱 검색 품질이 낮음 (단순 hash 기반).
 *         RAG 검색 정확도가 중요하면 OPENAI_EMBEDDINGS_ENABLED=1 또는
 *         로컬 sentence-transformers 도입 필요 — 별도 phase.
 */

import OpenAI from "openai";
import crypto from "node:crypto";

const EMBEDDINGS_ENABLED = process.env.OPENAI_EMBEDDINGS_ENABLED === "1";
const EMBEDDING_MODEL = "text-embedding-3-small";
const EMBEDDING_DIM = 1536;
const BATCH_SIZE = 100;

// OpenAI 클라이언트는 lazy init (켜진 경우만 인스턴스화)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  }
  return _openai;
}

/**
 * Deterministic hash embedding (무료 폴백)
 *
 * 같은 텍스트는 항상 같은 벡터 → 정확 일치 검색은 가능
 * 단, 시맨틱 유사도(예: "강아지" vs "댕댕이")는 잡지 못함
 */
function hashEmbedding(text: string): number[] {
  const normalized = text.replace(/\n/g, " ").trim().toLowerCase();
  const vec = new Array<number>(EMBEDDING_DIM).fill(0);

  // 텍스트의 SHA-256 해시를 시드로 사용해서 1536개 float 채움
  let seedHex = crypto.createHash("sha256").update(normalized).digest("hex");
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    if (seedHex.length < 8) {
      seedHex = crypto.createHash("sha256").update(seedHex).digest("hex");
    }
    const chunk = seedHex.slice(0, 8);
    seedHex = seedHex.slice(8);
    // 0~0xffffffff → -1.0~1.0
    const u32 = parseInt(chunk, 16);
    vec[i] = (u32 / 0xffffffff) * 2 - 1;
  }

  // L2 정규화 (코사인 유사도 호환)
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

/**
 * 단일 텍스트 임베딩 (검색 시 사용)
 */
export async function embedText(text: string): Promise<number[]> {
  if (!EMBEDDINGS_ENABLED || !process.env.OPENAI_API_KEY) {
    console.warn(
      "[embedText] ⚠️ OpenAI Embeddings API 차단됨 — hash embedding 폴백"
    );
    return hashEmbedding(text);
  }

  const response = await getOpenAI().embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.replace(/\n/g, " ").trim(),
  });
  return response.data[0].embedding;
}

/**
 * 벌크 임베딩 (처리 시 사용, 100개씩 배치)
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  if (!EMBEDDINGS_ENABLED || !process.env.OPENAI_API_KEY) {
    console.warn(
      `[embedBatch] ⚠️ OpenAI Embeddings API 차단됨 — hash embedding 폴백 (${texts.length}개)`
    );
    return texts.map(hashEmbedding);
  }

  const openai = getOpenAI();
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
