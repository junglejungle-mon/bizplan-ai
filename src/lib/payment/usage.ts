/**
 * 사용량 추적 헬퍼
 * - 월별 사용량 조회/증가
 * - 한도 체크 (limits에서 -1 = 무제한)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveSubscription, getPlanByName } from "./subscription";
import type { Database } from "@/lib/supabase/types";

type UsageRecord = Database["public"]["Tables"]["usage_records"]["Row"];

// ── 사용량 타입 ──

export type UsageType =
  | "plan_generations"
  | "section_regenerations"
  | "ir_generations"
  | "exports";

export interface UsageSummary {
  period: string;
  usage: Record<UsageType, number>;
  limits: Record<UsageType, number>;
  planName: string;
  planDisplayName: string;
}

// ── 기간 헬퍼 ──

/**
 * 현재 월 기간 문자열 (YYYY-MM)
 */
export function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ── 사용량 조회 ──

/**
 * 현재 월 사용량 조회 (없으면 자동 생성)
 */
export async function getOrCreateUsage(userId: string): Promise<UsageRecord> {
  const supabase = createAdminClient();
  const period = getCurrentPeriod();

  // 기존 레코드 조회
  const { data: existing } = await supabase
    .from("usage_records")
    .select("*")
    .eq("user_id", userId)
    .eq("period", period)
    .single();

  if (existing) return existing;

  // 없으면 새로 생성
  const { data: created, error } = await supabase
    .from("usage_records")
    .insert({
      user_id: userId,
      period,
      plan_generations: 0,
      section_regenerations: 0,
      ir_generations: 0,
      exports: 0,
    })
    .select()
    .single();

  if (error) throw new Error(`사용량 레코드 생성 실패: ${error.message}`);
  return created;
}

/**
 * 사용량 + 한도 요약
 */
export async function getUsageSummary(userId: string): Promise<UsageSummary> {
  const usage = await getOrCreateUsage(userId);

  // 활성 구독에서 한도 가져오기
  const subscription = await getActiveSubscription(userId);

  let limits: Record<UsageType, number>;
  let planName: string;
  let planDisplayName: string;

  if (subscription?.plan) {
    const planLimits = subscription.plan.limits as Record<string, number>;
    limits = {
      plan_generations: planLimits.plan_generations ?? 1,
      section_regenerations: planLimits.section_regenerations ?? 3,
      ir_generations: planLimits.ir_generations ?? 0,
      exports: planLimits.exports ?? 1,
    };
    planName = subscription.plan.name;
    planDisplayName = subscription.plan.display_name;
  } else {
    // 무료 플랜 기본값
    const freePlan = await getPlanByName("free");
    const freeLimits = (freePlan?.limits || {}) as Record<string, number>;
    limits = {
      plan_generations: freeLimits.plan_generations ?? 1,
      section_regenerations: freeLimits.section_regenerations ?? 3,
      ir_generations: freeLimits.ir_generations ?? 0,
      exports: freeLimits.exports ?? 1,
    };
    planName = "free";
    planDisplayName = "무료";
  }

  return {
    period: usage.period,
    usage: {
      plan_generations: usage.plan_generations,
      section_regenerations: usage.section_regenerations,
      ir_generations: usage.ir_generations,
      exports: usage.exports,
    },
    limits,
    planName,
    planDisplayName,
  };
}

// ── 사용량 증가 ──

/**
 * 특정 사용량 1 증가
 */
export async function incrementUsage(
  userId: string,
  type: UsageType
): Promise<{ allowed: boolean; current: number; limit: number }> {
  const summary = await getUsageSummary(userId);
  const currentValue = summary.usage[type];
  const limitValue = summary.limits[type];

  // -1 = 무제한
  if (limitValue !== -1 && currentValue >= limitValue) {
    return { allowed: false, current: currentValue, limit: limitValue };
  }

  // 사용량 증가
  const supabase = createAdminClient();
  const period = getCurrentPeriod();

  const { error } = await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period: period,
    p_type: type,
  });

  // RPC가 없으면 직접 업데이트
  if (error) {
    const usage = await getOrCreateUsage(userId);
    const updateData: Record<string, unknown> = {
      [type]: (usage[type] as number) + 1,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("usage_records")
      .update(updateData)
      .eq("user_id", userId)
      .eq("period", period);
  }

  return { allowed: true, current: currentValue + 1, limit: limitValue };
}

// ── 한도 체크 (증가 없이) ──

/**
 * 특정 타입의 사용 가능 여부만 확인
 */
export async function checkUsageLimit(
  userId: string,
  type: UsageType
): Promise<{ allowed: boolean; current: number; limit: number; remaining: number }> {
  const summary = await getUsageSummary(userId);
  const currentValue = summary.usage[type];
  const limitValue = summary.limits[type];

  // -1 = 무제한
  if (limitValue === -1) {
    return { allowed: true, current: currentValue, limit: -1, remaining: -1 };
  }

  const remaining = Math.max(0, limitValue - currentValue);
  return {
    allowed: currentValue < limitValue,
    current: currentValue,
    limit: limitValue,
    remaining,
  };
}
