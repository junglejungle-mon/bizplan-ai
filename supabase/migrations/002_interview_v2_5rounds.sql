-- ========================================
-- AI 인터뷰 v2: 5라운드 시스템 확장
-- 로우데이터 확보 + 전략적 방향 유도
-- ========================================

-- 1. round 제약 확장 (3 → 5)
ALTER TABLE company_interviews
  DROP CONSTRAINT IF EXISTS company_interviews_round_check;

ALTER TABLE company_interviews
  ADD CONSTRAINT company_interviews_round_check
  CHECK (round BETWEEN 1 AND 5);

-- 2. category 제약 확장 (새 카테고리 추가)
ALTER TABLE company_interviews
  DROP CONSTRAINT IF EXISTS company_interviews_category_check;

ALTER TABLE company_interviews
  ADD CONSTRAINT company_interviews_category_check
  CHECK (category IN ('basic', 'business', 'team_evidence', 'strategy', 'optimization'));

-- 3. 인덱스 추가 (라운드별 조회 성능)
CREATE INDEX IF NOT EXISTS idx_company_interviews_round
  ON company_interviews(company_id, round);

CREATE INDEX IF NOT EXISTS idx_company_interviews_order
  ON company_interviews(company_id, question_order);
