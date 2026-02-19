-- 012: Agent Team Meeting & Mission System
-- 에이전트 팀 자율 운영 시스템 (주간/월간 회의 + 미션 관리)

-- 테이블 1: agent_meetings — 회의 기록
CREATE TABLE IF NOT EXISTS agent_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('weekly', 'monthly')),
  meeting_date DATE NOT NULL,
  week_number INT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'collecting_metrics',
      'strategy_meeting',
      'team_analysis',
      'uploading_notion',
      'completed',
      'failed'
    )),
  current_phase TEXT,
  -- CDO 수집 결과
  service_metrics JSONB,
  -- CSO 전략 회의 마크다운
  strategy_summary TEXT,
  -- 구조화된 전략 결정사항
  strategy_result JSONB,
  -- 팀별 분석 [{team_id, analysis, action_items}]
  team_reports JSONB DEFAULT '[]'::jsonb,
  -- 노션 연동
  notion_page_id TEXT,
  notion_page_url TEXT,
  -- 비용/성능 추적
  total_tokens INT DEFAULT 0,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  duration_ms INT,
  -- 메타
  triggered_by TEXT DEFAULT 'cron',
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 테이블 2: agent_missions — 실행 미션
CREATE TABLE IF NOT EXISTS agent_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES agent_meetings(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL,
  team_name TEXT NOT NULL,
  chief TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'strategy', 'marketing', 'product', 'tech', 'data', 'growth', 'ops'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN (
    'critical', 'high', 'medium', 'low'
  )),
  expected_outcome TEXT,
  kpi_target JSONB,
  -- 승인 워크플로우
  approval_status TEXT NOT NULL DEFAULT 'pending' CHECK (approval_status IN (
    'pending', 'approved', 'rejected', 'deferred'
  )),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  -- 실행 추적
  execution_status TEXT NOT NULL DEFAULT 'waiting' CHECK (execution_status IN (
    'waiting', 'in_progress', 'completed', 'blocked', 'cancelled'
  )),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  completion_notes TEXT,
  due_date DATE,
  -- 노션 연동
  notion_block_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX idx_agent_meetings_date ON agent_meetings(meeting_date DESC);
CREATE INDEX idx_agent_meetings_status ON agent_meetings(status);
CREATE INDEX idx_agent_meetings_type ON agent_meetings(meeting_type);

CREATE INDEX idx_agent_missions_meeting ON agent_missions(meeting_id);
CREATE INDEX idx_agent_missions_approval ON agent_missions(approval_status);
CREATE INDEX idx_agent_missions_execution ON agent_missions(execution_status);
CREATE INDEX idx_agent_missions_team ON agent_missions(team_id);
CREATE INDEX idx_agent_missions_priority ON agent_missions(priority);

-- RLS 정책
ALTER TABLE agent_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_missions ENABLE ROW LEVEL SECURITY;

-- 서비스 역할(admin)만 접근 가능
CREATE POLICY "service_role_agent_meetings" ON agent_meetings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "service_role_agent_missions" ON agent_missions
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_agent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_meetings_updated_at
  BEFORE UPDATE ON agent_meetings
  FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();

CREATE TRIGGER agent_missions_updated_at
  BEFORE UPDATE ON agent_missions
  FOR EACH ROW EXECUTE FUNCTION update_agent_updated_at();
