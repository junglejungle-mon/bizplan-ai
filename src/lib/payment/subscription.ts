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
export async function createSubscription(params: {
  userId: string;
  planId: string;
  portonePaymentId?: string;
  portoneBillingKey?: string;
}): Promise<Subscription> {
  const supabase = createAdminClient();

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
}): Promise<string> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("payments")
    .insert({
      user_id: params.userId,
      amount: params.amount,
      currency: "KRW",
      status: "pending",
      portone_payment_id: params.portonePaymentId,
      subscription_id: params.subscriptionId || null,
      metadata: {},
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
