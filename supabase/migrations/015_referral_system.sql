-- ============================================================
-- 015. 바이럴 루프 추천 시스템 (Referral System)
-- 추천인: 사업계획서 3건 무료 크레딧
-- 피추천인: 사업계획서 1건 무료 크레딧
-- ============================================================

-- 1. referral_codes: 추천 코드
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_referrals INTEGER NOT NULL DEFAULT 0,
  successful_referrals INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 고유 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_user ON public.referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes(code);

-- 2. referrals: 추천 이력
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'expired', 'revoked')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(referred_id) -- 한 사용자는 한 번만 추천받을 수 있음
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON public.referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);

-- 3. referral_rewards: 추천 보상 (크레딧)
CREATE TABLE IF NOT EXISTS public.referral_rewards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('referrer_credit', 'referred_credit', 'milestone_bonus')),
  credits INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_rewards_user ON public.referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_active ON public.referral_rewards(user_id, is_active) WHERE is_active = true;

-- 4. referral_events: 추천 이벤트 로그
CREATE TABLE IF NOT EXISTS public.referral_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'link_clicked', 'signup_started', 'signup_completed',
    'reward_granted', 'reward_used', 'milestone_reached',
    'share_kakao', 'share_link', 'share_copy'
  )),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_referral_events_code ON public.referral_events(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referral_events_type ON public.referral_events(event_type);
CREATE INDEX IF NOT EXISTS idx_referral_events_actor ON public.referral_events(actor_id);

-- ============================================================
-- RLS 정책
-- ============================================================

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

-- referral_codes: 본인 코드만 조회/수정
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- referrals: 추천인/피추천인 본인만 조회
CREATE POLICY "Users can view own referrals"
  ON public.referrals FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

-- referral_rewards: 본인 보상만 조회
CREATE POLICY "Users can view own rewards"
  ON public.referral_rewards FOR SELECT
  USING (auth.uid() = user_id);

-- referral_events: 본인 관련 이벤트만 조회
CREATE POLICY "Users can view own events"
  ON public.referral_events FOR SELECT
  USING (auth.uid() = actor_id);

-- ============================================================
-- 뷰: 추천 대시보드 요약
-- ============================================================

CREATE OR REPLACE VIEW public.referral_dashboard AS
SELECT
  rc.user_id,
  rc.code,
  rc.total_referrals,
  rc.successful_referrals,
  COALESCE(SUM(rr.credits) FILTER (WHERE rr.is_active = true), 0) AS total_credits,
  COALESCE(SUM(rr.credits_used) FILTER (WHERE rr.is_active = true), 0) AS credits_used,
  COALESCE(SUM(rr.credits - rr.credits_used) FILTER (WHERE rr.is_active = true AND rr.credits > rr.credits_used), 0) AS credits_available
FROM public.referral_codes rc
LEFT JOIN public.referral_rewards rr ON rr.user_id = rc.user_id AND rr.is_active = true
GROUP BY rc.user_id, rc.code, rc.total_referrals, rc.successful_referrals;
