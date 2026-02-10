-- =============================================
-- 005: RAG Reference System (pgvector)
-- 레퍼런스 사업계획서 벡터 검색 시스템
-- =============================================

-- 1. pgvector 확장 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. 레퍼런스 문서 테이블
CREATE TABLE IF NOT EXISTS reference_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT,
  reference_type TEXT NOT NULL DEFAULT 'business_plan',
  template_type TEXT NOT NULL DEFAULT 'custom',
  status TEXT NOT NULL DEFAULT 'pending',
  ocr_text TEXT,
  metadata JSONB DEFAULT '{}',
  chunk_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 레퍼런스 청크 테이블 (벡터 임베딩 포함)
CREATE TABLE IF NOT EXISTS reference_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES reference_documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  section_name TEXT,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  embedding vector(1536),
  token_count INTEGER DEFAULT 0,
  template_type TEXT,
  reference_type TEXT DEFAULT 'business_plan',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_reference_documents_status ON reference_documents(status);
CREATE INDEX IF NOT EXISTS idx_reference_documents_type ON reference_documents(reference_type, template_type);
CREATE INDEX IF NOT EXISTS idx_reference_chunks_document_id ON reference_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_reference_chunks_template_type ON reference_chunks(template_type);

-- 5. IVFFlat 벡터 인덱스 (코사인 유사도)
CREATE INDEX IF NOT EXISTS idx_reference_chunks_embedding ON reference_chunks
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- 6. 벡터 유사도 검색 RPC 함수
CREATE OR REPLACE FUNCTION match_reference_chunks(
  query_embedding vector(1536),
  match_count INTEGER DEFAULT 3,
  match_threshold FLOAT DEFAULT 0.3,
  filter_template_type TEXT DEFAULT NULL,
  filter_reference_type TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  section_name TEXT,
  chunk_index INTEGER,
  template_type TEXT,
  reference_type TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.document_id,
    rc.content,
    rc.section_name,
    rc.chunk_index,
    rc.template_type,
    rc.reference_type,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM reference_chunks rc
  JOIN reference_documents rd ON rd.id = rc.document_id
  WHERE
    rd.status = 'completed'
    AND rc.embedding IS NOT NULL
    AND (filter_template_type IS NULL OR rc.template_type = filter_template_type)
    AND (filter_reference_type IS NULL OR rc.reference_type = filter_reference_type)
    AND 1 - (rc.embedding <=> query_embedding) > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- 7. RLS 정책 (reference_documents는 관리자만, 읽기는 서비스 롤)
ALTER TABLE reference_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_chunks ENABLE ROW LEVEL SECURITY;

-- 서비스 롤은 모든 작업 가능
CREATE POLICY "Service role full access on reference_documents"
  ON reference_documents FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access on reference_chunks"
  ON reference_chunks FOR ALL
  USING (true)
  WITH CHECK (true);
