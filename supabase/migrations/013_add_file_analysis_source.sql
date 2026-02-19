-- 013: company_documents source 체크 제약조건에 'file_analysis' 추가
-- 파일 업로드 → AI 분석 기능에서 사용

ALTER TABLE company_documents
  DROP CONSTRAINT IF EXISTS company_documents_source_check;

ALTER TABLE company_documents
  ADD CONSTRAINT company_documents_source_check
  CHECK (source IN ('hometax', 'mss', 'insurance', 'manual_upload', 'file_analysis'));
