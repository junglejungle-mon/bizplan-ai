/**
 * 알림 발송 서비스
 * - 사용자 알림 설정 확인 → 전화번호 조회 → 솔라피 발송 → 로그 저장
 */

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendAlimtalk,
  sendBulkAlimtalk,
  getTemplateId,
  type NotificationType,
} from "./solapi-client";

interface SendNotificationParams {
  userId: string;
  type: NotificationType;
  variables: Record<string, string>;
}

/**
 * 단건 카카오 알림톡 발송
 * 1. notification_settings에서 해당 유저의 kakao 채널이 enabled인지 + type별 on/off 확인
 * 2. profiles에서 phone 조회
 * 3. 솔라피 발송
 * 4. notification_logs에 결과 기록
 */
export async function sendKakaoNotification(
  params: SendNotificationParams
): Promise<{ sent: boolean; reason?: string }> {
  const supabase = createAdminClient();

  // 1. 알림 설정 확인
  const { data: settings } = await supabase
    .from("notification_settings")
    .select("*")
    .eq("user_id", params.userId)
    .eq("channel", "kakao")
    .single();

  if (!settings || !settings.enabled) {
    return { sent: false, reason: "카카오 알림이 비활성화되어 있습니다" };
  }

  // 유형별 on/off 확인
  const typeEnabled =
    params.type === "matching"
      ? settings.notify_matching
      : params.type === "deadline"
        ? settings.notify_deadline
        : settings.notify_plan_complete;

  if (!typeEnabled) {
    return { sent: false, reason: `${params.type} 알림이 비활성화되어 있습니다` };
  }

  // 2. 전화번호 조회
  const { data: profile } = await supabase
    .from("profiles")
    .select("phone")
    .eq("id", params.userId)
    .single();

  if (!profile?.phone) {
    return { sent: false, reason: "전화번호가 등록되지 않았습니다" };
  }

  // 3. 템플릿 ID 조회
  const templateId = getTemplateId(params.type);
  if (!templateId) {
    return { sent: false, reason: `${params.type} 템플릿이 설정되지 않았습니다` };
  }

  // 4. 발송
  const result = await sendAlimtalk({
    to: profile.phone,
    templateId,
    variables: params.variables,
  });

  // 5. 로그 저장
  await supabase.from("notification_logs").insert({
    user_id: params.userId,
    channel: "kakao",
    notification_type: params.type,
    template_id: templateId,
    recipient: profile.phone,
    variables: params.variables,
    status: result.success ? "sent" : "failed",
    error_message: result.error || null,
    sent_at: result.success ? new Date().toISOString() : null,
  });

  return {
    sent: result.success,
    reason: result.error,
  };
}

/**
 * 일괄 카카오 알림톡 발송 (마감 임박 등)
 * 알림 설정이 켜져있고 전화번호가 있는 사용자만 대상
 */
export async function sendBulkKakaoNotification(params: {
  type: NotificationType;
  /** userId → 해당 유저에게 보낼 변수 */
  userVariables: Map<string, Record<string, string>>;
}): Promise<{
  total: number;
  sent: number;
  skipped: number;
}> {
  const supabase = createAdminClient();
  const userIds = Array.from(params.userVariables.keys());

  if (userIds.length === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  // 1. 알림 설정이 켜진 유저 필터
  const typeColumn =
    params.type === "matching"
      ? "notify_matching"
      : params.type === "deadline"
        ? "notify_deadline"
        : "notify_plan_complete";

  const { data: enabledSettings } = await supabase
    .from("notification_settings")
    .select("user_id")
    .eq("channel", "kakao")
    .eq("enabled", true)
    .eq(typeColumn, true)
    .in("user_id", userIds);

  const enabledUserIds = new Set(
    (enabledSettings ?? []).map((s: any) => s.user_id)
  );

  // 2. 전화번호 조회
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, phone")
    .in("id", Array.from(enabledUserIds))
    .not("phone", "is", null);

  if (!profiles || profiles.length === 0) {
    return { total: userIds.length, sent: 0, skipped: userIds.length };
  }

  // 3. 템플릿 ID
  const templateId = getTemplateId(params.type);
  if (!templateId) {
    return { total: userIds.length, sent: 0, skipped: userIds.length };
  }

  // 4. 발송 대상 구성
  const messages = profiles
    .filter((p: any) => p.phone && params.userVariables.has(p.id))
    .map((p: any) => ({
      to: p.phone as string,
      variables: params.userVariables.get(p.id)!,
    }));

  if (messages.length === 0) {
    return { total: userIds.length, sent: 0, skipped: userIds.length };
  }

  // 5. 대량 발송
  const result = await sendBulkAlimtalk(messages, templateId);

  // 6. 로그 저장 (일괄)
  const logs = profiles
    .filter((p: any) => p.phone && params.userVariables.has(p.id))
    .map((p: any) => ({
      user_id: p.id,
      channel: "kakao" as const,
      notification_type: params.type,
      template_id: templateId,
      recipient: p.phone,
      variables: params.userVariables.get(p.id),
      status: result.success > 0 ? ("sent" as const) : ("failed" as const),
      sent_at: result.success > 0 ? new Date().toISOString() : null,
    }));

  if (logs.length > 0) {
    await supabase.from("notification_logs").insert(logs);
  }

  return {
    total: userIds.length,
    sent: result.success,
    skipped: userIds.length - messages.length,
  };
}
