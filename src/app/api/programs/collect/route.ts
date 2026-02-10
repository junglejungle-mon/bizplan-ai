import { NextRequest } from "next/server";
import { collectAllPrograms } from "@/lib/pipeline/collector";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBulkKakaoNotification } from "@/lib/notification/notification-service";

// Vercel Serverless Function 타임아웃 확대 (Hobby: 최대 60초, Pro: 최대 300초)
export const maxDuration = 300;

/**
 * GET /api/programs/collect
 * Vercel Cron Job: 매일 09:00 (KST) = 00:00 (UTC)
 * 전체 페이지 수집 + 자동 매칭 트리거 + 마감 임박 알림
 * 수동 호출도 가능 (인증 필요)
 */
export async function GET(request: NextRequest) {
  // Vercel Cron 인증 체크
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Vercel Cron에서 호출 시 CRON_SECRET 체크, 없으면 허용 (개발 환경)
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await collectAllPrograms();

    // 마감 임박 알림 발송 (D-3, D-1)
    let deadlineNotifications = { total: 0, sent: 0, skipped: 0 };
    try {
      deadlineNotifications = await sendDeadlineNotifications();
    } catch (e) {
      console.error("[Collect] 마감 임박 알림 실패:", e);
    }

    return Response.json({
      success: true,
      ...result,
      deadlineNotifications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Collect] 전체 수집 실패:", error);
    return Response.json(
      {
        success: false,
        error: String(error),
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * 마감 임박 알림 (D-3, D-1)
 * 수집 완료 후 매칭된 공고 중 마감이 3일 이내인 공고의 사용자에게 일괄 발송
 */
async function sendDeadlineNotifications() {
  const supabase = createAdminClient();

  const today = new Date();
  const d3 = new Date(today);
  d3.setDate(d3.getDate() + 3);
  const d1 = new Date(today);
  d1.setDate(d1.getDate() + 1);

  // D-3 ~ D-1 마감 공고 조회
  const { data: urgentPrograms } = await supabase
    .from("programs")
    .select("id, title, apply_end")
    .gte("apply_end", today.toISOString().split("T")[0])
    .lte("apply_end", d3.toISOString().split("T")[0]);

  if (!urgentPrograms || urgentPrograms.length === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  const programIds = urgentPrograms.map((p: any) => p.id);

  // 이 공고에 매칭된 사용자 조회 (match_score >= 60)
  const { data: matchings } = await supabase
    .from("matchings")
    .select("company_id, program_id")
    .in("program_id", programIds)
    .gte("match_score", 60);

  if (!matchings || matchings.length === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  // company_id → user_id 매핑
  const companyIds = [...new Set(matchings.map((m: any) => m.company_id))];
  const { data: companies } = await supabase
    .from("companies")
    .select("id, user_id, name")
    .in("id", companyIds);

  if (!companies || companies.length === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  const companyMap = new Map(companies.map((c: any) => [c.id, c]));
  const programMap = new Map(urgentPrograms.map((p: any) => [p.id, p]));

  // userId → 알림 변수 (가장 긴급한 공고 기준)
  const userVariables = new Map<string, Record<string, string>>();

  for (const m of matchings) {
    const company = companyMap.get(m.company_id);
    const program = programMap.get(m.program_id);
    if (!company || !program) continue;

    const applyEnd = new Date(program.apply_end);
    const daysLeft = Math.ceil(
      (applyEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 이미 해당 유저에게 더 긴급한 공고가 있으면 건너뛰기
    const existing = userVariables.get(company.user_id);
    if (existing && parseInt(existing["#{남은일수}"]) <= daysLeft) {
      continue;
    }

    userVariables.set(company.user_id, {
      "#{공고명}": program.title.slice(0, 30),
      "#{남은일수}": String(daysLeft),
    });
  }

  if (userVariables.size === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  return sendBulkKakaoNotification({
    type: "deadline",
    userVariables,
  });
}
