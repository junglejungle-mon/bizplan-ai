-- 새 수집 소스 추가
-- kstartup-biz: K-Startup 사업상세정보 (예산, 지원내용 등)
-- kotra: KOTRA 수출지원사업 크롤링

ALTER TABLE programs
  DROP CONSTRAINT IF EXISTS programs_source_check;

ALTER TABLE programs
  ADD CONSTRAINT programs_source_check
  CHECK (source IN ('bizinfo', 'mss', 'kstartup', 'kstartup-biz', 'kotra'));
