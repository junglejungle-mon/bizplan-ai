/**
 * 솔라피(Solapi) 카카오 알림톡 클라이언트
 * 환경변수:
 *   SOLAPI_API_KEY, SOLAPI_API_SECRET
 *   SOLAPI_KAKAO_PF_ID (카카오톡 채널 프로필 ID)
 *   SOLAPI_SENDER_PHONE (발신번호)
 *   SOLAPI_TPL_MATCHING, SOLAPI_TPL_DEADLINE, SOLAPI_TPL_PLAN_COMPLETE (템플릿 ID)
 */

import { SolapiMessageService } from "solapi";

let client: SolapiMessageService | null = null;

function getClient(): SolapiMessageService {
  if (!client) {
    const apiKey = process.env.SOLAPI_API_KEY;
    const apiSecret = process.env.SOLAPI_API_SECRET;

    if (!apiKey || !apiSecret) {
      throw new Error("SOLAPI_API_KEY / SOLAPI_API_SECRET 환경변수가 설정되지 않았습니다");
    }

    client = new SolapiMessageService(apiKey, apiSecret);
  }
  return client;
}

export type NotificationType = "matching" | "deadline" | "plan_complete";

const TEMPLATE_IDS: Record<NotificationType, string | undefined> = {
  matching: process.env.SOLAPI_TPL_MATCHING,
  deadline: process.env.SOLAPI_TPL_DEADLINE,
  plan_complete: process.env.SOLAPI_TPL_PLAN_COMPLETE,
};

interface SendKakaoAlimtalkParams {
  to: string;
  templateId: string;
  variables: Record<string, string>;
}

/**
 * 카카오 알림톡 단건 발송
 */
export async function sendAlimtalk(params: SendKakaoAlimtalkParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const solapi = getClient();
    const pfId = process.env.SOLAPI_KAKAO_PF_ID;
    const from = process.env.SOLAPI_SENDER_PHONE;

    if (!pfId || !from) {
      throw new Error("SOLAPI_KAKAO_PF_ID / SOLAPI_SENDER_PHONE 환경변수가 필요합니다");
    }

    const result = await solapi.sendOne({
      to: params.to,
      from,
      kakaoOptions: {
        pfId,
        templateId: params.templateId,
        variables: params.variables,
      },
    });

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error: any) {
    console.error("[Solapi] 알림톡 발송 실패:", error);
    return {
      success: false,
      error: error.message || String(error),
    };
  }
}

/**
 * 카카오 알림톡 대량 발송
 */
export async function sendBulkAlimtalk(
  messages: Array<{
    to: string;
    variables: Record<string, string>;
  }>,
  templateId: string
): Promise<{
  total: number;
  success: number;
  failed: number;
}> {
  const pfId = process.env.SOLAPI_KAKAO_PF_ID;
  const from = process.env.SOLAPI_SENDER_PHONE;

  if (!pfId || !from) {
    throw new Error("SOLAPI_KAKAO_PF_ID / SOLAPI_SENDER_PHONE 환경변수가 필요합니다");
  }

  const solapi = getClient();
  let success = 0;
  let failed = 0;

  // 솔라피 대량 발송 (최대 10,000건/요청)
  const messagePayloads = messages.map((msg) => ({
    to: msg.to,
    from,
    kakaoOptions: {
      pfId,
      templateId,
      variables: msg.variables,
    },
  }));

  try {
    await solapi.send(messagePayloads);
    success = messages.length;
  } catch (error) {
    console.error("[Solapi] 대량 발송 실패:", error);
    failed = messages.length;
  }

  return { total: messages.length, success, failed };
}

/**
 * 알림 유형별 템플릿 ID 조회
 */
export function getTemplateId(type: NotificationType): string | null {
  return TEMPLATE_IDS[type] || null;
}
