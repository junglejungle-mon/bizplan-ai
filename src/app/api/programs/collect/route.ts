import { NextRequest } from "next/server";
import { collectAllPrograms, type CollectSource } from "@/lib/pipeline/collector";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBulkKakaoNotification } from "@/lib/notification/notification-service";

const VALID_SOURCES: CollectSource[] = ["bizinfo", "mss", "kstartup", "kstartup-biz", "kotra", "sbiz24"];

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

  // CRON_SECRET 미설정 시 항상 거부 (개발 환경에서도 보안 유지)
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // ?source=bizinfo|mss|kstartup 파라미터로 소스별 분리 수집
    const sourceParam = request.nextUrl.searchParams.get("source") as CollectSource | null;
    const source = sourceParam && VALID_SOURCES.includes(sourceParam) ? sourceParam : undefined;

    console.log(`[Collect] 수집 시작 — source: ${source || "all"}`);
    const result = await collectAllPrograms(source);

    // 마감 임박 알림은 전체 수집 또는 마지막 소스(kstartup)에서만
    let deadlineNotifications = { total: 0, sent: 0, skipped: 0 };
    if (!source || source === "sbiz24") {
      try {
        deadlineNotifications = await sendDeadlineNotifications();
      } catch (e) {
        console.error("[Collect] 마감 임박 알림 실패:", e);
      }
    }

    return Response.json({
      success: true,
      source: source || "all",
      ...result,
      deadlineNotifications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Collect] 전체 수집 실패:", error);
    return Response.json(
      {
        success: false,
        error: "수집 처리 중 오류가 발생했습니다",
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

  const programIds = urgentPrograms.map((p: { id: string; title: string; apply_end: string }) => p.id);

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
  const companyIds = [...new Set(matchings.map((m: { company_id: string; program_id: string }) => m.company_id))];
  const { data: companies } = await supabase
    .from("companies")
    .select("id, user_id, name")
    .in("id", companyIds);

  if (!companies || companies.length === 0) {
    return { total: 0, sent: 0, skipped: 0 };
  }

  type CompanyRow = { id: string; user_id: string; name: string };
  type ProgramRow = { id: string; title: string; apply_end: string };
  const companyMap = new Map(companies.map((c: CompanyRow) => [c.id, c]));
  const programMap = new Map(urgentPrograms.map((p: ProgramRow) => [p.id, p]));

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
      "#{회원이름}": "고객",
      "#{공고명}": program.title.slice(0, 30),
      "#{남은일수}": String(daysLeft),
      "#{링크}": "https://bizplanai.co.kr/programs",
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
