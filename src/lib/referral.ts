/**
 * 바이럴 루프 추천 시스템
 * - 추천 코드 생성/검증
 * - 추천 보상 처리 (추천인 3크레딧, 피추천인 1크레딧)
 * - 크레딧 사용/조회
 * - 마일스톤 보상
 */

import { createAdminClient } from "@/lib/supabase/admin";

// ── 상수 ──

/** 추천인 보상: 사업계획서 생성 크레딧 */
export const REFERRER_CREDITS = 3;

/** 피추천인 보상: 사업계획서 생성 크레딧 */
export const REFERRED_CREDITS = 1;

/** 크레딧 유효 기간 (일) */
export const CREDIT_EXPIRY_DAYS = 90;

/** 마일스톤 보상 */
export const MILESTONES = [
  { count: 5, reward: "pro_1month", description: "Pro 플랜 1개월 무료", credits: 10 },
  { count: 10, reward: "allfree_1month", description: "올프리 플랜 1개월 + 파트너 뱃지", credits: 20 },
] as const;

// ── 추천 코드 생성 ──

/**
 * 사용자 고유 추천 코드 생성 (없으면 새로 생성)
 */
export async function getOrCreateReferralCode(userId: string): Promise<{
  code: string;
  totalReferrals: number;
  successfulReferrals: number;
}> {
  const supabase = createAdminClient();

  // 기존 코드 확인
  const { data: existing } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (existing) {
    return {
      code: existing.code,
      totalReferrals: existing.total_referrals,
      successfulReferrals: existing.successful_referrals,
    };
  }

  // 새 코드 생성 (6자리 영숫자 + 체크섬)
  const code = await generateUniqueCode(supabase);

  const { data: created, error } = await supabase
    .from("referral_codes")
    .insert({
      user_id: userId,
      code,
      is_active: true,
      total_referrals: 0,
      successful_referrals: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`추천 코드 생성 실패: ${error.message}`);

  return {
    code: created.code,
    totalReferrals: 0,
    successfulReferrals: 0,
  };
}

/**
 * 고유 추천 코드 생성 (6자리)
 */
async function generateUniqueCode(supabase: ReturnType<typeof createAdminClient>): Promise<string> {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 혼동 방지 (0,O,1,I 제외)
  let attempts = 0;

  while (attempts < 10) {
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // 중복 확인
    const { data } = await supabase
      .from("referral_codes")
      .select("id")
      .eq("code", code)
      .limit(1);

    if (!data || data.length === 0) return code;
    attempts++;
  }

  // 10번 실패 시 타임스탬프 기반
  const ts = Date.now().toString(36).toUpperCase().slice(-6);
  return ts;
}

// ── 추천 링크 ──

/**
 * 추천 링크 생성
 */
export function getReferralLink(code: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bizplanai.co.kr";
  return `${baseUrl}/signup?ref=${code}`;
}

// ── 추천 처리 ──

/**
 * 회원가입 시 추천 코드 처리
 * - 추천인/피추천인 모두에게 크레딧 부여
 */
export async function processReferralSignup(params: {
  newUserId: string;
  referralCode: string;
}): Promise<{ success: boolean; error?: string }> {
  const supabase = createAdminClient();

  // 1. 추천 코드 유효성 확인
  const { data: codeData } = await supabase
    .from("referral_codes")
    .select("*")
    .eq("code", params.referralCode.toUpperCase())
    .eq("is_active", true)
    .single();

  if (!codeData) {
    return { success: false, error: "유효하지 않은 추천 코드입니다" };
  }

  // 2. 자기 추천 방지
  if (codeData.user_id === params.newUserId) {
    return { success: false, error: "본인의 추천 코드는 사용할 수 없습니다" };
  }

  // 3. 이미 추천받은 사용자인지 확인
  const { data: existingReferral } = await supabase
    .from("referrals")
    .select("id")
    .eq("referred_id", params.newUserId)
    .limit(1);

  if (existingReferral && existingReferral.length > 0) {
    return { success: false, error: "이미 추천을 통해 가입한 사용자입니다" };
  }

  // 4. 추천 레코드 생성
  const { data: referral, error: refError } = await supabase
    .from("referrals")
    .insert({
      referrer_id: codeData.user_id,
      referred_id: params.newUserId,
      referral_code_id: codeData.id,
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (refError) {
    return { success: false, error: `추천 처리 실패: ${refError.message}` };
  }

  // 5. 크레딧 만료일 계산
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CREDIT_EXPIRY_DAYS);

  // 6. 추천인 보상 (3 크레딧)
  await supabase.from("referral_rewards").insert({
    user_id: codeData.user_id,
    referral_id: referral.id,
    reward_type: "referrer_credit",
    credits: REFERRER_CREDITS,
    credits_used: 0,
    description: `추천 보상: 사업계획서 ${REFERRER_CREDITS}건 무료`,
    expires_at: expiresAt.toISOString(),
    is_active: true,
  });

  // 7. 피추천인 보상 (1 크레딧)
  await supabase.from("referral_rewards").insert({
    user_id: params.newUserId,
    referral_id: referral.id,
    reward_type: "referred_credit",
    credits: REFERRED_CREDITS,
    credits_used: 0,
    description: `가입 축하: 사업계획서 ${REFERRED_CREDITS}건 무료`,
    expires_at: expiresAt.toISOString(),
    is_active: true,
  });

  // 8. 추천 코드 카운터 업데이트
  await supabase
    .from("referral_codes")
    .update({
      total_referrals: codeData.total_referrals + 1,
      successful_referrals: codeData.successful_referrals + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", codeData.id);

  // 9. 이벤트 로그
  await supabase.from("referral_events").insert([
    {
      referral_code_id: codeData.id,
      event_type: "signup_completed",
      actor_id: params.newUserId,
      metadata: { referrer_id: codeData.user_id },
    },
    {
      referral_code_id: codeData.id,
      event_type: "reward_granted",
      actor_id: codeData.user_id,
      metadata: { credits: REFERRER_CREDITS, type: "referrer_credit" },
    },
    {
      referral_code_id: codeData.id,
      event_type: "reward_granted",
      actor_id: params.newUserId,
      metadata: { credits: REFERRED_CREDITS, type: "referred_credit" },
    },
  ]);

  // 10. 마일스톤 체크
  await checkAndGrantMilestone(codeData.user_id, codeData.successful_referrals + 1);

  // 11. 추천인에게 알림 발송
  await notifyReferrer(codeData.user_id, params.newUserId);

  return { success: true };
}

// ── 크레딧 조회/사용 ──

/**
 * 사용 가능한 추천 크레딧 총합 조회
 */
export async function getAvailableCredits(userId: string): Promise<number> {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("referral_rewards")
    .select("credits, credits_used")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (!data || data.length === 0) return 0;

  return data.reduce((sum, r) => sum + Math.max(0, r.credits - r.credits_used), 0);
}

/**
 * 추천 크레딧 1건 사용 (FIFO: 가장 오래된 것부터)
 */
export async function consumeReferralCredit(userId: string): Promise<boolean> {
  const supabase = createAdminClient();

  // 사용 가능한 보상 중 가장 오래된 것
  const { data: rewards } = await supabase
    .from("referral_rewards")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("created_at", { ascending: true });

  if (!rewards || rewards.length === 0) return false;

  for (const reward of rewards) {
    const remaining = reward.credits - reward.credits_used;
    if (remaining <= 0) continue;

    // 크레딧 1 차감
    const newUsed = reward.credits_used + 1;
    const isFullyUsed = newUsed >= reward.credits;

    await supabase
      .from("referral_rewards")
      .update({
        credits_used: newUsed,
        is_active: !isFullyUsed,
      })
      .eq("id", reward.id);

    // 이벤트 로그
    await supabase.from("referral_events").insert({
      referral_code_id: null,
      event_type: "reward_used",
      actor_id: userId,
      metadata: {
        reward_id: reward.id,
        reward_type: reward.reward_type,
        credits_remaining: reward.credits - newUsed,
      },
    });

    return true;
  }

  return false;
}

/**
 * 추천 대시보드 데이터 조회
 */
export async function getReferralDashboard(userId: string): Promise<{
  code: string;
  referralLink: string;
  totalReferrals: number;
  successfulReferrals: number;
  creditsAvailable: number;
  creditsUsed: number;
  recentReferrals: Array<{
    id: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
  }>;
  milestones: Array<{
    count: number;
    reward: string;
    description: string;
    achieved: boolean;
  }>;
}> {
  const supabase = createAdminClient();

  // 코드 & 통계
  const codeInfo = await getOrCreateReferralCode(userId);
  const creditsAvailable = await getAvailableCredits(userId);

  // 사용된 크레딧 총합
  const { data: usedData } = await supabase
    .from("referral_rewards")
    .select("credits_used")
    .eq("user_id", userId);

  const creditsUsed = usedData
    ? usedData.reduce((sum, r) => sum + (r.credits_used || 0), 0)
    : 0;

  // 최근 추천 이력 (최대 10건)
  const { data: referrals } = await supabase
    .from("referrals")
    .select("id, status, created_at, completed_at")
    .eq("referrer_id", userId)
    .order("created_at", { ascending: false })
    .limit(10);

  // 마일스톤 달성 여부
  const milestones = MILESTONES.map((m) => ({
    count: m.count,
    reward: m.reward,
    description: m.description,
    achieved: codeInfo.successfulReferrals >= m.count,
  }));

  return {
    code: codeInfo.code,
    referralLink: getReferralLink(codeInfo.code),
    totalReferrals: codeInfo.totalReferrals,
    successfulReferrals: codeInfo.successfulReferrals,
    creditsAvailable,
    creditsUsed,
    recentReferrals: (referrals || []).map((r) => ({
      id: r.id,
      status: r.status,
      createdAt: r.created_at,
      completedAt: r.completed_at,
    })),
    milestones,
  };
}

// ── 공유 이벤트 로깅 ──

/**
 * 공유 이벤트 기록
 */
export async function logShareEvent(
  userId: string,
  shareType: "share_kakao" | "share_link" | "share_copy"
): Promise<void> {
  const supabase = createAdminClient();

  // 사용자의 추천 코드 ID 조회
  const { data: codeData } = await supabase
    .from("referral_codes")
    .select("id")
    .eq("user_id", userId)
    .single();

  await supabase.from("referral_events").insert({
    referral_code_id: codeData?.id || null,
    event_type: shareType,
    actor_id: userId,
    metadata: { timestamp: new Date().toISOString() },
  });
}

// ── 내부 헬퍼 ──

/**
 * 마일스톤 달성 체크 및 보상 지급
 */
async function checkAndGrantMilestone(userId: string, currentCount: number): Promise<void> {
  const supabase = createAdminClient();

  for (const milestone of MILESTONES) {
    if (currentCount !== milestone.count) continue;

    // 이미 해당 마일스톤 보상을 받았는지 확인
    const { data: existing } = await supabase
      .from("referral_rewards")
      .select("id")
      .eq("user_id", userId)
      .eq("reward_type", "milestone_bonus")
      .eq("description", milestone.description)
      .limit(1);

    if (existing && existing.length > 0) continue;

    // 보상 지급
    await supabase.from("referral_rewards").insert({
      user_id: userId,
      reward_type: "milestone_bonus",
      credits: milestone.credits,
      credits_used: 0,
      description: milestone.description,
      is_active: true,
    });

    // 이벤트 로그
    await supabase.from("referral_events").insert({
      event_type: "milestone_reached",
      actor_id: userId,
      metadata: {
        milestone_count: milestone.count,
        reward: milestone.reward,
        credits: milestone.credits,
      },
    });

    // 알림
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "system",
      title: "🎉 마일스톤 달성!",
      message: `${milestone.count}명 추천 달성! ${milestone.description}을 받았습니다.`,
      link: "/dashboard/referral",
      is_read: false,
    });
  }
}

/**
 * 추천인에게 알림 발송
 */
async function notifyReferrer(referrerId: string, newUserId: string): Promise<void> {
  const supabase = createAdminClient();

  // 피추천인 이름 조회 (마스킹)
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", newUserId)
    .single();

  const name = profile?.name || "새 회원";
  const maskedName = name.length > 1
    ? name[0] + "*".repeat(name.length - 1)
    : name;

  // 인앱 알림
  await supabase.from("notifications").insert({
    user_id: referrerId,
    type: "system",
    title: "🎁 추천 보상 도착!",
    message: `${maskedName}님이 회원가입했습니다! 사업계획서 ${REFERRER_CREDITS}건 무료 크레딧이 지급되었어요.`,
    link: "/dashboard/referral",
    is_read: false,
  });

  // 카카오 알림톡 (선택)
  try {
    const { sendKakaoNotification } = await import(
      "@/lib/notification/notification-service"
    );
    await sendKakaoNotification({
      userId: referrerId,
      type: "plan_complete",
      variables: {
        "#{회원이름}": "고객",
        "#{계획서명}": "추천 보상 알림",
        "#{품질점수}": `${REFERRER_CREDITS}건 무료 크레딧`,
        "#{링크}": "https://bizplanai.co.kr/dashboard",
      },
    });
  } catch {
    // 카카오 발송 실패해도 인앱 알림은 이미 전달됨
  }
}
