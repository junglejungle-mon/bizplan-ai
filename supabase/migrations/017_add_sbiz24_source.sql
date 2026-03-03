-- 새 수집 소스 추가
-- sbiz24: 소상공인24 (외부 연계 공고 + 융자상품)

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_source_check;

ALTER TABLE programs
  ADD CONSTRAINT programs_source_check
  CHECK (source IN ('bizinfo', 'mss', 'kstartup', 'kstartup-biz', 'kotra', 'sbiz24'));
