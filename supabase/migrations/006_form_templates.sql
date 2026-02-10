-- 006_form_templates.sql
-- 양식폼 캐시 테이블 + business_plans 확장

CREATE TABLE IF NOT EXISTS form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES programs(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  file_type TEXT CHECK (file_type IN ('hwpx', 'hwp')),
  file_size INT,
  storage_path TEXT,
  parsed_structure JSONB,
  field_mappings JSONB,
  form_title TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'downloaded', 'parsed', 'mapped', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(program_id, source_url)
);

-- business_plans에 양식 관련 컬럼 추가
ALTER TABLE business_plans
  ADD COLUMN IF NOT EXISTS form_template_id UUID REFERENCES form_templates(id),
  ADD COLUMN IF NOT EXISTS fill_strategy TEXT DEFAULT 'from_scratch';

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_form_templates_program_id ON form_templates(program_id);
CREATE INDEX IF NOT EXISTS idx_form_templates_status ON form_templates(status);

-- RLS 정책 (form_templates는 programs를 통해 간접 접근)
ALTER TABLE form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "form_templates_select_policy" ON form_templates
  FOR SELECT USING (true);

CREATE POLICY "form_templates_insert_policy" ON form_templates
  FOR INSERT WITH CHECK (true);

CREATE POLICY "form_templates_update_policy" ON form_templates
  FOR UPDATE USING (true);
