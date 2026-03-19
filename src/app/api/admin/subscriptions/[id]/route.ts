/**
 * GET/PATCH/DELETE /api/admin/subscriptions/[id]
 * 관리자: 구독 상세 조회 / 수정 / 강제 취소
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";
import { validateBody, adminUpdateSubscriptionSchema } from "@/lib/api/validation";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;

    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("*, plan:subscription_plans(*)")
      .eq("id", id)
      .single();

    if (error || !subscription) {
      return Response.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    // 사용자 프로필 조회
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, name, email")
      .eq("id", subscription.user_id)
      .maybeSingle();

    // 관련 결제 내역
    const { data: payments } = await supabase
      .from("payments")
      .select("id, amount, status, paid_at, created_at")
      .eq("subscription_id", id)
      .order("created_at", { ascending: false });

    return Response.json({
      subscription,
      profile,
      payments: payments || [],
    });
  } catch (error) {
    console.error("[admin/subscriptions/id] GET 오류:", error);
    return apiError(error, "구독 조회 실패", 500);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;
    const [subBody, subErr] = await validateBody(request, adminUpdateSubscriptionSchema);
    if (subErr) return subErr;

    // 허용 필드만 추출
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(subBody)) {
      if (value !== undefined) updates[key] = value;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "수정할 필드가 없습니다." }, { status: 400 });
    }

    // 기존 구독 확인
    const { data: existing, error: findError } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      return Response.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    // 플랜 변경 시 유효성 확인
    if (updates.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from("subscription_plans")
        .select("id, name")
        .eq("id", updates.plan_id)
        .single();

      if (planError || !plan) {
        return Response.json({ error: "유효하지 않은 플랜입니다." }, { status: 400 });
      }
    }

    // 상태 변경 시 추가 필드
    if (updates.status === "canceled" || updates.status === "expired") {
      updates.canceled_at = new Date().toISOString();
    }

    updates.updated_at = new Date().toISOString();
    updates.metadata = {
      ...(existing.metadata as Record<string, unknown>),
      last_admin_action: {
        type: "manual_update",
        fields: Object.keys(updates).filter((k) => k !== "updated_at" && k !== "metadata"),
        at: new Date().toISOString(),
      },
    };

    const { data: subscription, error: updateError } = await supabase
      .from("subscriptions")
      .update(updates)
      .eq("id", id)
      .select("*, plan:subscription_plans(*)")
      .single();

    if (updateError) {
      return apiError(updateError, "구독 수정 실패", 500);
    }

    return Response.json({ subscription });
  } catch (error) {
    console.error("[admin/subscriptions/id] PATCH 오류:", error);
    return apiError(error, "구독 수정 실패", 500);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { id } = await params;

    // 구독 존재 확인
    const { data: existing, error: findError } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("id", id)
      .single();

    if (findError || !existing) {
      return Response.json({ error: "구독 정보를 찾을 수 없습니다." }, { status: 404 });
    }

    // 활성 구독 즉시 만료 처리 (물리적 삭제 대신)
    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        status: "expired",
        canceled_at: new Date().toISOString(),
        cancel_at_period_end: false,
        metadata: {
          expired_reason: "admin_force_cancel",
          force_canceled_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      return apiError(updateError, "구독 취소 실패", 500);
    }

    return Response.json({ success: true, message: "구독이 강제 취소되었습니다." });
  } catch (error) {
    console.error("[admin/subscriptions/id] DELETE 오류:", error);
    return apiError(error, "구독 취소 실패", 500);
  }
}
