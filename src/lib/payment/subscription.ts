/**
 * 구독 관리 헬퍼 (Service Role)
 * - 구독 CRUD
 * - 플랜 조회
 * - 구독 상태 관리
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type SubscriptionPlan = Database["public"]["Tables"]["subscription_plans"]["Row"];
type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];

/**
 * 안전한 월 추가 (월말 오버플로 방지)
 * 예: 1/31 + 1개월 = 2/28 (윤년: 2/29)
 */
function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const targetMonth = result.getMonth() + months;
  result.setMonth(targetMonth);
  // 월이 넘어간 경우 (31 → 다음달 3일 등) → 마지막 날로 보정
  if (result.getMonth() !== ((targetMonth % 12) + 12) % 12) {
    result.setDate(0); // 이전 달의 마지막 날
  }
  return result;
}

// ── 플랜 조회 ──

/**
 * 활성 플랜 목록 조회 (정렬순)
 */
export async function getActivePlans(): Promise<SubscriptionPlan[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(`플랜 조회 실패: ${error.message}`);
  return data || [];
}

/**
 * 플랜 단건 조회
 */
export async function getPlanById(planId: string): Promise<SubscriptionPlan | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (error) return null;
  return data;
}

/**
 * 이름으로 플랜 조회
 */
export async function getPlanByName(name: string): Promise<SubscriptionPlan | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("name", name)
    .single();

  if (error) return null;
  return data;
}

// ── 구독 관리 ──

/**
 * 사용자의 현재 활성 구독 조회 (플랜 정보 포함)
 */
export async function getActiveSubscription(
  userId: string
): Promise<(Subscription & { plan: SubscriptionPlan }) | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*, plan:subscription_plans(*)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .single();

  if (error || !data) return null;
  return data as Subscription & { plan: SubscriptionPlan };
}

/**
 * 새 구독 생성
 */
// 동시 구독 생성 방지를 위한 인메모리 락
const subscriptionLocks = new Map<string, Promise<Subscription>>();

export async function createSubscription(params: {
  userId: string;
  planId: string;
  portonePaymentId?: string;
  portoneBillingKey?: string;
}): Promise<Subscription> {
  // 동일 사용자 동시 요청 방지 (verify + webhook 동시 도착 시)
  const existingLock = subscriptionLocks.get(params.userId);
  if (existingLock) {
    console.warn("[subscription] 동시 요청 감지, 기존 결과 대기:", params.userId);
    return existingLock;
  }

  const promise = _createSubscriptionInternal(params);
  subscriptionLocks.set(params.userId, promise);

  try {
    const result = await promise;
    return result;
  } finally {
    subscriptionLocks.delete(params.userId);
  }
}

async function _createSubscriptionInternal(params: {
  userId: string;
  planId: string;
  portonePaymentId?: string;
  portoneBillingKey?: string;
}): Promise<Subscription> {
  const supabase = createAdminClient();

  // 이미 같은 결제로 구독이 생성되었는지 확인 (멱등성)
  if (params.portonePaymentId) {
    const { data: existingSub } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("portone_customer_id", params.portonePaymentId)
      .eq("status", "active")
      .single();

    if (existingSub) {
      console.warn("[subscription] 이미 생성된 구독 반환:", existingSub.id);
      return existingSub;
    }
  }

  // 기존 활성 구독 만료 처리
  await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .in("status", ["active", "trialing"]);

  // 구독 기간 계산 (1개월, 월말 안전 처리)
  const now = new Date();
  const periodEnd = addMonths(now, 1);

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: params.userId,
      plan_id: params.planId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      portone_billing_key: params.portoneBillingKey || null,
      portone_customer_id: params.portonePaymentId || null,
      metadata: {},
    })
    .select()
    .single();

  if (error) throw new Error(`구독 생성 실패: ${error.message}`);
  return data;
}

/**
 * 구독 취소 (기간 끝까지 유지)
 */
export async function cancelSubscription(
  subscriptionId: string,
  userId: string
): Promise<Subscription> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      cancel_at_period_end: true,
      canceled_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw new Error(`구독 취소 실패: ${error.message}`);
  return data;
}

/**
 * 구독 즉시 만료
 */
export async function expireSubscription(subscriptionId: string): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) throw new Error(`구독 만료 처리 실패: ${error.message}`);
}

/**
 * Free Trial 구독 생성 (14일 무료 체험)
 */
export async function createTrialSubscription(params: {
  userId: string;
  planId: string;
}): Promise<Subscription> {
  const supabase = createAdminClient();

  // 이미 trial 사용 이력이 있는지 확인
  const { data: pastTrial } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", params.userId)
    .or("status.eq.trialing,trial_start.not.is.null")
    .limit(1);

  if (pastTrial && pastTrial.length > 0) {
    throw new Error("이미 무료 체험을 사용하셨습니다. 유료 플랜을 선택해주세요.");
  }

  // 기존 활성 구독 만료 처리
  await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("user_id", params.userId)
    .in("status", ["active", "trialing"]);

  const now = new Date();
  const trialEnd = new Date(now);
  trialEnd.setDate(trialEnd.getDate() + 14);

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: params.userId,
      plan_id: params.planId,
      status: "trialing",
      current_period_start: now.toISOString(),
      current_period_end: trialEnd.toISOString(),
      trial_start: now.toISOString(),
      trial_end: trialEnd.toISOString(),
      metadata: { trial: true },
    })
    .select()
    .single();

  if (error) throw new Error(`Trial 생성 실패: ${error.message}`);
  return data;
}

/**
 * 만료된 Trial/구독 처리 (스케줄러에서 호출)
 */
export async function processExpiredSubscriptions(): Promise<{ trials: number; subscriptions: number }> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // 만료된 trial 처리
  const { data: expiredTrials } = await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: now })
    .eq("status", "trialing")
    .lt("current_period_end", now)
    .select("id");

  // 취소 예약된 구독 중 기간 만료된 것 처리
  const { data: expiredSubs } = await supabase
    .from("subscriptions")
    .update({ status: "expired", updated_at: now })
    .eq("status", "active")
    .eq("cancel_at_period_end", true)
    .lt("current_period_end", now)
    .select("id");

  return {
    trials: expiredTrials?.length || 0,
    subscriptions: expiredSubs?.length || 0,
  };
}

/**
 * 구독 갱신 (자동 갱신 / 수동 연장)
 */
export async function renewSubscription(subscriptionId: string): Promise<Subscription> {
  const supabase = createAdminClient();

  const { data: current, error: fetchError } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("id", subscriptionId)
    .single();

  if (fetchError || !current) throw new Error("구독을 찾을 수 없습니다");

  const newStart = new Date(current.current_period_end);
  const newEnd = addMonths(newStart, 1);

  const { data, error } = await supabase
    .from("subscriptions")
    .update({
      status: "active",
      current_period_start: newStart.toISOString(),
      current_period_end: newEnd.toISOString(),
      cancel_at_period_end: false,
      canceled_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId)
    .select()
    .single();

  if (error) throw new Error(`구독 갱신 실패: ${error.message}`);
  return data;
}

// ── 결제 기록 ──

/**
 * 결제 기록 생성 (pending)
 */
export async function createPaymentRecord(params: {
  userId: string;
  amount: number;
  portonePaymentId: string;
  subscriptionId?: string;
  planId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  const supabase = createAdminClient();

  const baseMetadata = params.planId ? { planId: params.planId } : {};
  const mergedMetadata = { ...baseMetadata, ...(params.metadata || {}) };

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: params.userId,
      amount: params.amount,
      currency: "KRW",
      status: "pending",
      portone_payment_id: params.portonePaymentId,
      subscription_id: params.subscriptionId || null,
      metadata: mergedMetadata,
    })
    .select("id")
    .single();

  if (error) throw new Error(`결제 기록 생성 실패: ${error.message}`);
  return data.id;
}

/**
 * 결제 상태 업데이트
 */
export async function updatePaymentStatus(params: {
  portonePaymentId: string;
  status: string;
  paidAt?: string;
  paymentMethod?: string;
  paymentMethodDetail?: Record<string, unknown>;
  failedReason?: string;
  receiptUrl?: string;
  subscriptionId?: string;
}): Promise<void> {
  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {
    status: params.status,
    updated_at: new Date().toISOString(),
  };

  if (params.paidAt) updateData.paid_at = params.paidAt;
  if (params.paymentMethod) updateData.payment_method = params.paymentMethod;
  if (params.paymentMethodDetail) updateData.payment_method_detail = params.paymentMethodDetail;
  if (params.failedReason) updateData.failed_reason = params.failedReason;
  if (params.receiptUrl) updateData.receipt_url = params.receiptUrl;
  if (params.subscriptionId) updateData.subscription_id = params.subscriptionId;

  const { error } = await supabase
    .from("payments")
    .update(updateData)
    .eq("portone_payment_id", params.portonePaymentId);

  if (error) throw new Error(`결제 상태 업데이트 실패: ${error.message}`);
}

/**
 * 사용자의 결제 이력 조회
 */
export async function getUserPayments(
  userId: string,
  limit: number = 20
): Promise<Database["public"]["Tables"]["payments"]["Row"][]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`결제 이력 조회 실패: ${error.message}`);
  return data || [];
}

// ── 관리자 조회 ──

/**
 * 관리자: 전체 구독 목록
 */
export async function getAllSubscriptions(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: (Subscription & { plan: SubscriptionPlan })[]; total: number }> {
  const supabase = createAdminClient();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("subscriptions")
    .select("*, plan:subscription_plans(*)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`구독 목록 조회 실패: ${error.message}`);
  return {
    data: (data || []) as (Subscription & { plan: SubscriptionPlan })[],
    total: count || 0,
  };
}

/**
 * 관리자: 전체 결제 목록
 */
export async function getAllPayments(params: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{ data: Database["public"]["Tables"]["payments"]["Row"][]; total: number }> {
  const supabase = createAdminClient();
  const page = params.page || 1;
  const limit = params.limit || 20;
  const offset = (page - 1) * limit;

  let query = supabase
    .from("payments")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.status) {
    query = query.eq("status", params.status);
  }

  const { data, error, count } = await query;

  if (error) throw new Error(`결제 목록 조회 실패: ${error.message}`);
  return {
    data: data || [],
    total: count || 0,
  };
}

// ── 비례환불 (프로레이션) ──

export interface ProrateResult {
  /** 기존 구독 남은 일수 */
  remainingDays: number;
  /** 기존 구독 전체 기간 (일) */
  totalDays: number;
  /** 기존 구독 일일 단가 (원) */
  dailyRate: number;
  /** 잔여 기간 크레딧 (원) */
  credit: number;
  /** 새 플랜 가격 (원) */
  newPlanPrice: number;
  /** 실제 결제 금액 (새 플랜 가격 - 크레딧, 최소 0) */
  chargeAmount: number;
}

/**
 * 업그레이드 비례환불 금액 계산
 *
 * 기존 구독의 남은 기간에 대한 비례 크레딧을 계산하고,
 * 새 플랜 가격에서 차감한 실 결제 금액을 반환합니다.
 *
 * @param currentSub - 현재 활성 구독 (플랜 정보 포함)
 * @param newPlan - 업그레이드할 새 플랜
 * @returns 비례환불 계산 결과
 */
export function calculateProration(
  currentSub: Subscription & { plan: SubscriptionPlan },
  newPlan: SubscriptionPlan
): ProrateResult {
  const now = new Date();
  const periodStart = currentSub.current_period_start
    ? new Date(currentSub.current_period_start)
    : now;
  const periodEnd = currentSub.current_period_end
    ? new Date(currentSub.current_period_end)
    : addMonths(now, 1);

  // 전체 기간 (일)
  const totalDays = Math.max(
    1,
    Math.ceil((periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24))
  );

  // 남은 일수
  const remainingDays = Math.max(
    0,
    Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  );

  // 기존 플랜 가격
  const currentPrice = Number(currentSub.plan.price) || 0;

  // 일일 단가
  const dailyRate = totalDays > 0 ? Math.round(currentPrice / totalDays) : 0;

  // 잔여 크레딧
  const credit = dailyRate * remainingDays;

  // 새 플랜 가격
  const newPlanPrice = Number(newPlan.price) || 0;

  // 실 결제 금액 (크레딧 차감, 최소 0)
  const chargeAmount = Math.max(0, newPlanPrice - credit);

  return {
    remainingDays,
    totalDays,
    dailyRate,
    credit,
    newPlanPrice,
    chargeAmount,
  };
}

/**
 * 업그레이드 구독 생성 (비례환불 적용)
 *
 * 기존 구독을 만료하고, 크레딧이 적용된 새 구독을 생성합니다.
 * 결제 기록에 프로레이션 메타데이터를 포함합니다.
 */
export async function upgradeSubscription(params: {
  userId: string;
  newPlanId: string;
  portonePaymentId?: string;
  proration: ProrateResult;
}): Promise<Subscription> {
  const supabase = createAdminClient();
  const now = new Date();

  // 기존 활성 구독 만료 (업그레이드 사유 메타데이터 추가)
  const { data: expiredSubs } = await supabase
    .from("subscriptions")
    .update({
      status: "expired",
      updated_at: now.toISOString(),
      metadata: {
        expired_reason: "upgrade",
        upgraded_at: now.toISOString(),
        upgrade_credit: params.proration.credit,
      },
    })
    .eq("user_id", params.userId)
    .in("status", ["active", "trialing"])
    .select("id");

  const expiredSubId = expiredSubs?.[0]?.id || null;

  // 새 구독 생성 (1개월)
  const periodEnd = addMonths(now, 1);

  const { data, error } = await supabase
    .from("subscriptions")
    .insert({
      user_id: params.userId,
      plan_id: params.newPlanId,
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
      portone_customer_id: params.portonePaymentId || null,
      metadata: {
        upgraded_from: expiredSubId,
        proration: {
          credit: params.proration.credit,
          remaining_days: params.proration.remainingDays,
          charge_amount: params.proration.chargeAmount,
          original_price: params.proration.newPlanPrice,
        },
      },
    })
    .select()
    .single();

  if (error) throw new Error(`업그레이드 구독 생성 실패: ${error.message}`);
  return data;
}
