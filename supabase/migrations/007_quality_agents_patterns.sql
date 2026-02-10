-- 007: 품질 채점 + 에이전트 로그 + 선정 패턴 + 평가기준
-- BizPlan AI + 에이전트 스킬 통합

-- ============================================================
-- 1. 품질 채점 (100점 만점)
-- ============================================================
CREATE TABLE IF NOT EXISTS quality_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES business_plans(id) ON DELETE CASCADE,
  section_id UUID REFERENCES plan_sections(id) ON DELETE CASCADE,
  -- NULL이면 전체 플랜 점수, 값이 있으면 섹션별 점수

  total_score INT NOT NULL DEFAULT 0,  -- 0~100

  -- 11개 채점 항목 (각 항목별 점수)
  score_numeric_evidence INT DEFAULT 0,    -- 숫자 기반 실적 (15)
  score_tam_sam_som INT DEFAULT 0,         -- TAM/SAM/SOM (10)
  score_competitor_analysis INT DEFAULT 0, -- 경쟁사 비교 (10)
  score_roadmap INT DEFAULT 0,             -- 구체적 로드맵 (10)
  score_team_capability INT DEFAULT 0,     -- 팀 역량 상세 (10)
  score_budget_basis INT DEFAULT 0,        -- 사업비 산출근거 (10)
  score_risk_mitigation INT DEFAULT 0,     -- 리스크+대응 (5)
  score_ip_patent INT DEFAULT 0,           -- 특허/IP (5)
  score_social_value INT DEFAULT 0,        -- 사회적가치 (5)
  score_document_fit INT DEFAULT 0,        -- 서류 적합성 (10)
  score_charts_tables INT DEFAULT 0,       -- 차트/표 포함 (10)

  details JSONB,              -- 각 항목별 상세 피드백
  improvement_suggestions JSONB, -- AI 개선 제안
  scored_by TEXT DEFAULT 'auto', -- 'auto' | 'admin' | 'ai'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_quality_scores_plan ON quality_scores(plan_id);
CREATE INDEX idx_quality_scores_section ON quality_scores(section_id);

-- ============================================================
-- 2. 에이전트 실행 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 어떤 스킬이 실행되었는지
  skill_name TEXT NOT NULL,  -- '16-business-plan-writer', '17-ir-ppt-writer', '00-quality', etc.
  action TEXT NOT NULL,       -- 'generate_section', 'score_quality', 'research_market', etc.

  -- 관련 엔티티
  plan_id UUID REFERENCES business_plans(id) ON DELETE SET NULL,
  section_id UUID REFERENCES plan_sections(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- 실행 결과
  status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),

  -- 비용 추적
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  model_used TEXT,           -- 'claude-sonnet-4', 'claude-haiku-4.5', etc.
  cost_usd NUMERIC(10,6) DEFAULT 0,

  -- 메타데이터
  duration_ms INT,
  metadata JSONB,            -- 추가 정보 (프롬프트 버전, 파라미터 등)
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_skill ON agent_logs(skill_name);
CREATE INDEX idx_agent_logs_plan ON agent_logs(plan_id);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);

-- ============================================================
-- 3. 선정 패턴 (winning patterns DB화)
-- ============================================================
CREATE TABLE IF NOT EXISTS winning_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  category TEXT NOT NULL,    -- 'text_quality', 'structure', 'visual', 'strategy'
  subcategory TEXT NOT NULL, -- 'numeric_evidence', 'tam_sam_som', 'competitor', etc.

  title TEXT NOT NULL,       -- 패턴 제목
  description TEXT NOT NULL, -- 패턴 설명

  good_examples JSONB,      -- ["23년 매출 8억, 24년 30억 — 275% 성장", ...]
  bad_examples JSONB,        -- ["많은 고객을 확보하고 있습니다", ...]

  applicable_templates TEXT[], -- {'startup_package', 'growth_package', 'dips', ...}
  weight INT DEFAULT 10,     -- 이 패턴의 중요도 (채점 배점과 연동)

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. 평가기준 (양식별)
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  template_type TEXT NOT NULL, -- 'startup_package', 'growth_package', 'dips', 'export_voucher', 'sme_fund'

  section_name TEXT NOT NULL,  -- '문제인식', '실현가능성', '성장전략', '팀구성'
  score_weight INT NOT NULL,   -- 배점 (예: 25, 30)

  criteria TEXT[],             -- 세부 기준 배열
  high_score_strategy TEXT,    -- 고득점 전략

  section_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(template_type, section_name)
);

-- ============================================================
-- 5. 프롬프트 버전 관리
-- ============================================================
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  prompt_key TEXT NOT NULL,    -- 'section_generator', 'quality_scorer', 'market_research', etc.
  version INT NOT NULL DEFAULT 1,

  prompt_text TEXT NOT NULL,

  -- A/B 테스트용
  is_active BOOLEAN DEFAULT true,
  avg_quality_score NUMERIC(5,2), -- 이 프롬프트로 생성된 결과의 평균 품질점수
  usage_count INT DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(prompt_key, version)
);

-- ============================================================
-- 6. business_plans에 품질점수 컬럼 추가
-- ============================================================
ALTER TABLE business_plans
  ADD COLUMN IF NOT EXISTS quality_score INT,
  ADD COLUMN IF NOT EXISTS template_type TEXT;

-- ============================================================
-- RLS 정책 (service_role만 접근)
-- ============================================================
ALTER TABLE quality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE winning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions ENABLE ROW LEVEL SECURITY;

-- Service role full access
DO $$ BEGIN
  CREATE POLICY "Service role access quality_scores" ON quality_scores FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role access agent_logs" ON agent_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role access winning_patterns" ON winning_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role access evaluation_criteria" ON evaluation_criteria FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Service role access prompt_versions" ON prompt_versions FOR ALL TO service_role USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Users can read their own quality scores
DO $$ BEGIN
  CREATE POLICY "Users read own quality_scores" ON quality_scores FOR SELECT TO authenticated
    USING (plan_id IN (
      SELECT bp.id FROM business_plans bp
      JOIN companies c ON bp.company_id = c.id
      WHERE c.user_id = auth.uid()
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
