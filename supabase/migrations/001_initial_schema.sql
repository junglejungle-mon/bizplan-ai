-- BizPlan AI 초기 스키마
-- 실행: Supabase Dashboard > SQL Editor에서 실행

-- 1. 사용자 프로필
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. 회사 정보
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  business_content TEXT NOT NULL DEFAULT '',
  industry TEXT,
  region TEXT DEFAULT '서울, 경기',
  employee_count INT,
  revenue TEXT,
  established_date DATE,
  profile_score INT DEFAULT 0 CHECK (profile_score BETWEEN 0 AND 100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. AI 인터뷰
CREATE TABLE IF NOT EXISTS company_interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  category TEXT CHECK (category IN ('basic', 'business', 'optimization')),
  extracted_insights JSONB,
  question_order INT NOT NULL,
  round INT DEFAULT 1 CHECK (round BETWEEN 1 AND 3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 정부지원사업 공고
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL CHECK (source IN ('bizinfo', 'mss', 'kstartup')),
  source_id TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  target TEXT,
  hashtags TEXT[],
  apply_start DATE,
  apply_end DATE,
  institution TEXT,
  detail_url TEXT,
  attachment_urls JSONB,
  raw_data JSONB,
  collected_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, source_id)
);

-- 5. 매칭 결과
CREATE TABLE IF NOT EXISTS matchings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  match_score INT CHECK (match_score BETWEEN 0 AND 100),
  match_reason TEXT,
  deep_score INT,
  deep_report TEXT,
  region_match BOOLEAN,
  status TEXT DEFAULT 'analyzed' CHECK (status IN ('analyzed', 'bookmarked', 'applying', 'applied')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, program_id)
);

-- 6. 사업계획서
CREATE TABLE IF NOT EXISTS business_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  matching_id UUID REFERENCES matchings(id),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed', 'exported')),
  template_ocr_text TEXT,
  evaluation_criteria JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 사업계획서 섹션
CREATE TABLE IF NOT EXISTS plan_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  section_order INT NOT NULL,
  section_name TEXT NOT NULL,
  guidelines TEXT,
  evaluation_weight INT,
  needs_research BOOLEAN DEFAULT false,
  research_query_ko TEXT,
  research_query_en TEXT,
  research_result_ko TEXT,
  research_result_en TEXT,
  content TEXT,
  content_formatted TEXT,
  is_edited BOOLEAN DEFAULT false,
  generation_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 서류 관리
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('hometax', 'mss', 'insurance', 'manual_upload')),
  file_url TEXT,
  extracted_data JSONB,
  issued_date DATE,
  expiry_date DATE,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'extracted', 'error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. IR PPT
CREATE TABLE IF NOT EXISTS ir_presentations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  template TEXT DEFAULT 'minimal' CHECK (template IN ('minimal', 'tech', 'classic')),
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generating', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. IR 슬라이드
CREATE TABLE IF NOT EXISTS ir_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  presentation_id UUID NOT NULL REFERENCES ir_presentations(id) ON DELETE CASCADE,
  slide_order INT NOT NULL,
  slide_type TEXT NOT NULL,
  title TEXT,
  content JSONB,
  notes TEXT,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. AI 비서 대화
CREATE TABLE IF NOT EXISTS assistant_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_type TEXT CHECK (context_type IN ('general', 'program', 'plan', 'ir', 'strategy')),
  context_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS 정책
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE matchings ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE ir_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ir_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_chats ENABLE ROW LEVEL SECURITY;

-- profiles: 본인만 접근
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- companies: 본인 회사만 접근
CREATE POLICY "Users can view own companies" ON companies FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own companies" ON companies FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own companies" ON companies FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "Users can delete own companies" ON companies FOR DELETE USING (user_id = auth.uid());

-- company_interviews: 본인 회사의 인터뷰만 접근
CREATE POLICY "Users can view own interviews" ON company_interviews FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own interviews" ON company_interviews FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own interviews" ON company_interviews FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- programs: 모든 인증 유저 읽기 가능
CREATE POLICY "Authenticated users can view programs" ON programs FOR SELECT TO authenticated USING (true);

-- matchings: 본인 매칭만 접근
CREATE POLICY "Users can view own matchings" ON matchings FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own matchings" ON matchings FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own matchings" ON matchings FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- business_plans: 본인 계획서만 접근
CREATE POLICY "Users can view own plans" ON business_plans FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own plans" ON business_plans FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own plans" ON business_plans FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- plan_sections: 본인 계획서의 섹션만 접근
CREATE POLICY "Users can view own sections" ON plan_sections FOR SELECT
  USING (plan_id IN (SELECT id FROM business_plans WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));
CREATE POLICY "Users can insert own sections" ON plan_sections FOR INSERT
  WITH CHECK (plan_id IN (SELECT id FROM business_plans WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));
CREATE POLICY "Users can update own sections" ON plan_sections FOR UPDATE
  USING (plan_id IN (SELECT id FROM business_plans WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));

-- company_documents: 본인 서류만 접근
CREATE POLICY "Users can view own documents" ON company_documents FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own documents" ON company_documents FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own documents" ON company_documents FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ir_presentations: 본인 IR만 접근
CREATE POLICY "Users can view own ir" ON ir_presentations FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own ir" ON ir_presentations FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can update own ir" ON ir_presentations FOR UPDATE
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ir_slides: 본인 IR 슬라이드만 접근
CREATE POLICY "Users can view own slides" ON ir_slides FOR SELECT
  USING (presentation_id IN (SELECT id FROM ir_presentations WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));
CREATE POLICY "Users can insert own slides" ON ir_slides FOR INSERT
  WITH CHECK (presentation_id IN (SELECT id FROM ir_presentations WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));
CREATE POLICY "Users can update own slides" ON ir_slides FOR UPDATE
  USING (presentation_id IN (SELECT id FROM ir_presentations WHERE company_id IN (SELECT id FROM companies WHERE user_id = auth.uid())));

-- assistant_chats: 본인 대화만 접근
CREATE POLICY "Users can view own chats" ON assistant_chats FOR SELECT
  USING (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));
CREATE POLICY "Users can insert own chats" ON assistant_chats FOR INSERT
  WITH CHECK (company_id IN (SELECT id FROM companies WHERE user_id = auth.uid()));

-- ============================================
-- 트리거: 회원가입 시 프로필 자동 생성
-- ============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 인덱스
-- ============================================

CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_company_interviews_company_id ON company_interviews(company_id);
CREATE INDEX idx_programs_source ON programs(source);
CREATE INDEX idx_programs_apply_end ON programs(apply_end);
CREATE INDEX idx_matchings_company_id ON matchings(company_id);
CREATE INDEX idx_matchings_program_id ON matchings(program_id);
CREATE INDEX idx_matchings_match_score ON matchings(match_score);
CREATE INDEX idx_business_plans_company_id ON business_plans(company_id);
CREATE INDEX idx_plan_sections_plan_id ON plan_sections(plan_id);
CREATE INDEX idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX idx_ir_presentations_plan_id ON ir_presentations(plan_id);
CREATE INDEX idx_ir_slides_presentation_id ON ir_slides(presentation_id);
CREATE INDEX idx_assistant_chats_company_id ON assistant_chats(company_id);
