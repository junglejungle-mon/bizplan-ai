/**
 * 정부지원사업 수집 파이프라인
 * Vercel Cron에서 호출 → 3개 API에서 전체 수집 → programs 테이블 UPSERT
 * 수집 완료 후 → 모든 활성 회사에 대해 자동 매칭 트리거
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllBizinfoPrograms } from "@/lib/apis/bizinfo";
import { fetchAllMssBizPrograms } from "@/lib/apis/mss-biz";
import { fetchAllKStartupPrograms } from "@/lib/apis/kstartup";
import { parseDateRange } from "@/lib/ai/prompts/matching";
import { runMatchingPipeline } from "@/lib/pipeline/matcher";

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
  matching: { companyId: string; matched: number; skipped: number }[];
  errors: string[];
}> {
  const results: CollectedProgram[] = [];
  const errors: string[] = [];

  // 1. 기업마당 (전체 페이지 수집, 최대 1,000건)
  try {
    const bizinfoItems = await fetchAllBizinfoPrograms(10);
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

  // 2. 중소벤처기업부 (전체 페이지 수집, 최대 2,000건)
  try {
    const mssItems = await fetchAllMssBizPrograms(20);
    results.push(...mssItems);
    console.log(`[Collector] 중소벤처기업부: ${mssItems.length}건`);
  } catch (e) {
    errors.push(`중소벤처기업부 수집 실패: ${e}`);
    console.error("[Collector] 중소벤처기업부 오류:", e);
  }

  // 3. K-Startup (전체 페이지 수집, perPage=500, 최대 2,500건)
  try {
    const kstartupItems = await fetchAllKStartupPrograms(5);
    results.push(...kstartupItems);
    console.log(`[Collector] K-Startup: ${kstartupItems.length}건`);
  } catch (e) {
    errors.push(`K-Startup 수집 실패: ${e}`);
    console.error("[Collector] K-Startup 오류:", e);
  }

  // DB UPSERT (배치 단위 — 성능 최적화)
  const supabase = createAdminClient();
  let inserted = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < results.length; i += BATCH_SIZE) {
    const batch = results.slice(i, i + BATCH_SIZE);
    const rows = batch.map((program) => ({
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
    }));

    const { error } = await supabase
      .from("programs")
      .upsert(rows, { onConflict: "source,source_id" });

    if (error) {
      errors.push(`배치 UPSERT 실패 (${i}~${i + batch.length}): ${error.message}`);
    } else {
      inserted += batch.length;
    }
  }

  console.log(
    `[Collector] 수집 완료: 전체 ${results.length}건 중 ${inserted}건 저장`
  );

  // === 자동 매칭 파이프라인 트리거 ===
  const matchingResults: { companyId: string; matched: number; skipped: number }[] = [];

  try {
    // 활성 회사 중 프로필 점수 20+ 인 회사만 매칭
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, profile_score")
      .eq("is_active", true)
      .gte("profile_score", 20);

    if (companies && companies.length > 0) {
      console.log(`[Collector] 자동 매칭 시작: ${companies.length}개 회사`);

      for (const company of companies) {
        try {
          const result = await runMatchingPipeline(company.id);
          matchingResults.push({
            companyId: company.id,
            matched: result.matched,
            skipped: result.skipped,
          });
          console.log(
            `[Collector] 매칭 완료 [${company.name}]: ${result.matched}건 매칭, ${result.skipped}건 스킵`
          );
          if (result.errors.length > 0) {
            errors.push(...result.errors.map((e) => `[${company.name}] ${e}`));
          }
        } catch (e) {
          errors.push(`매칭 실패 [${company.name}]: ${e}`);
          console.error(`[Collector] 매칭 오류 [${company.name}]:`, e);
        }
      }
    }
  } catch (e) {
    errors.push(`자동 매칭 트리거 실패: ${e}`);
    console.error("[Collector] 자동 매칭 오류:", e);
  }

  const totalMatched = matchingResults.reduce((s, r) => s + r.matched, 0);
  console.log(
    `[Collector] 전체 완료: ${results.length}건 수집, ${inserted}건 저장, ${totalMatched}건 매칭`
  );

  return { total: results.length, inserted, matching: matchingResults, errors };
}
