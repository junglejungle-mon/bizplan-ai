-- 약관 동의 추적 (법적 요구사항)
-- OAuth 가입 시 약관 동의 우회 방지를 위한 스키마 확장

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS agreed_terms_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS agreed_privacy_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS terms_version TEXT DEFAULT '2026-02-13',
ADD COLUMN IF NOT EXISTS privacy_version TEXT DEFAULT '2026-02-13';

-- 기존 사용자는 가입일 기준으로 동의한 것으로 처리
UPDATE profiles
SET
  agreed_terms_at = created_at,
  agreed_privacy_at = created_at,
  terms_version = '2026-02-13',
  privacy_version = '2026-02-13'
WHERE agreed_terms_at IS NULL;

COMMENT ON COLUMN profiles.agreed_terms_at IS '이용약관 동의 일시';
COMMENT ON COLUMN profiles.agreed_privacy_at IS '개인정보처리방침 동의 일시';
COMMENT ON COLUMN profiles.terms_version IS '동의한 이용약관 시행일 버전';
COMMENT ON COLUMN profiles.privacy_version IS '동의한 개인정보처리방침 시행일 버전';
