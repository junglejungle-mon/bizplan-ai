/**
 * 정부지원사업 수집 파이프라인
 * Vercel Cron에서 호출 → 3개 API에서 수집 → programs 테이블 UPSERT
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchBizinfoPrograms } from "@/lib/apis/bizinfo";
import { fetchMssBizPrograms } from "@/lib/apis/mss-biz";
import { fetchKStartupPrograms } from "@/lib/apis/kstartup";
import { parseDateRange } from "@/lib/ai/prompts/matching";

interface CollectedProgram {
  source: "bizinfo" | "mss" | "kstartup";
  source_id: string;
  title: string;
  summary: string | null;
  target: string | null;
  hashtags: string[];
  apply_start?: string | null;
  apply_end?: string | null;
  apply_period?: string;
  institution: string | null;
  detail_url: string | null;
  attachment_urls: Record<string, any>;
  raw_data: Record<string, any>;
}

export async function collectAllPrograms(): Promise<{
  total: number;
  inserted: number;
  errors: string[];
}> {
  const results: CollectedProgram[] = [];
  const errors: string[] = [];

  // 1. 기업마당
  try {
    const bizinfoItems = await fetchBizinfoPrograms();
    for (const item of bizinfoItems) {
      const dates = parseDateRange(item.apply_period || "");
      results.push({
        ...item,
        apply_start: dates.start,
        apply_end: dates.end,
      });
    }
    console.log(`[Collector] 기업마당: ${bizinfoItems.length}건`);
  } catch (e) {
    errors.push(`기업마당 수집 실패: ${e}`);
    console.error("[Collector] 기업마당 오류:", e);
  }

  // 2. 중소벤처기업부
  try {
    const mssItems = await fetchMssBizPrograms();
    results.push(...mssItems);
    console.log(`[Collector] 중소벤처기업부: ${mssItems.length}건`);
  } catch (e) {
    errors.push(`중소벤처기업부 수집 실패: ${e}`);
    console.error("[Collector] 중소벤처기업부 오류:", e);
  }

  // 3. K-Startup
  try {
    const kstartupItems = await fetchKStartupPrograms();
    results.push(...kstartupItems);
    console.log(`[Collector] K-Startup: ${kstartupItems.length}건`);
  } catch (e) {
    errors.push(`K-Startup 수집 실패: ${e}`);
    console.error("[Collector] K-Startup 오류:", e);
  }

  // DB UPSERT (Service Role - RLS 우회)
  const supabase = createAdminClient();
  let inserted = 0;

  for (const program of results) {
    const { error } = await supabase.from("programs").upsert(
      {
        source: program.source,
        source_id: program.source_id,
        title: program.title,
        summary: program.summary,
        target: program.target,
        hashtags: program.hashtags,
        apply_start: program.apply_start || null,
        apply_end: program.apply_end || null,
        institution: program.institution,
        detail_url: program.detail_url,
        attachment_urls: program.attachment_urls,
        raw_data: program.raw_data,
        collected_at: new Date().toISOString(),
      },
      { onConflict: "source,source_id" }
    );

    if (error) {
      errors.push(`UPSERT 실패 [${program.title}]: ${error.message}`);
    } else {
      inserted++;
    }
  }

  console.log(
    `[Collector] 완료: 전체 ${results.length}건 중 ${inserted}건 저장`
  );

  return { total: results.length, inserted, errors };
}
