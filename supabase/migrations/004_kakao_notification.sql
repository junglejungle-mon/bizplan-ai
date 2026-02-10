-- 004: 카카오 알림톡 + 카카오 로그인 지원
-- profiles 확장 + notification_settings + notification_logs

-- 1. profiles 테이블에 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS kakao_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_kakao_id ON profiles(kakao_id);

-- 2. 알림 설정 테이블
CREATE TABLE IF NOT EXISTS notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('kakao', 'email', 'discord')),
  enabled BOOLEAN DEFAULT false,
  notify_matching BOOLEAN DEFAULT true,
  notify_deadline BOOLEAN DEFAULT true,
  notify_plan_complete BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, channel)
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings"
  ON notification_settings FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own notification settings"
  ON notification_settings FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own notification settings"
  ON notification_settings FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);

-- 3. 알림 발송 로그 테이블
CREATE TABLE IF NOT EXISTS notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('kakao', 'email', 'discord')),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('matching', 'deadline', 'plan_complete')),
  template_id TEXT,
  recipient TEXT,
  variables JSONB,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification logs"
  ON notification_logs FOR SELECT
  USING (user_id = auth.uid());

-- service_role만 insert 가능 (서버에서만 발송)
CREATE POLICY "Service role can insert notification logs"
  ON notification_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_status ON notification_logs(status);
CREATE INDEX idx_notification_logs_created_at ON notification_logs(created_at);

-- 4. handle_new_user 트리거 업데이트 (카카오 로그인 시 phone 자동 저장)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, phone, kakao_id)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'phone_number',
    CASE
      WHEN new.raw_app_meta_data->>'provider' = 'kakao'
      THEN new.raw_user_meta_data->>'provider_id'
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO UPDATE SET
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    kakao_id = COALESCE(EXCLUDED.kakao_id, profiles.kakao_id),
    name = COALESCE(EXCLUDED.name, profiles.name);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
