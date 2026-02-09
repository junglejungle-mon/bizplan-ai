-- 003: 매칭 시스템 v2 — 키워드 기반 + 다차원 점수 + 심층 분석
-- 2026-02-08

-- matchings 테이블에 새 컬럼 추가
ALTER TABLE matchings ADD COLUMN IF NOT EXISTS match_keywords TEXT[] DEFAULT '{}';
ALTER TABLE matchings ADD COLUMN IF NOT EXISTS match_detail TEXT;
ALTER TABLE matchings ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
ALTER TABLE matchings ADD COLUMN IF NOT EXISTS fit_level TEXT DEFAULT 'analyzed';

-- 인덱스 추가 (키워드 검색용)
CREATE INDEX IF NOT EXISTS idx_matchings_fit_level ON matchings(fit_level);
CREATE INDEX IF NOT EXISTS idx_matchings_match_keywords ON matchings USING GIN(match_keywords);
