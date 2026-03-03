/**
 * 정부지원사업 수집 파이프라인
 * Vercel Cron에서 호출 → 3개 API에서 전체 수집 → programs 테이블 UPSERT
 * 수집 완료 후 → 첨부파일 로컬 저장 + 양식 스킬화 + 자동 매칭 트리거
 *
 * v2: 로컬 파일 저장 + 스킬화 파이프라인 추가
 *   - 첨부파일(양식)을 data/programs/{source}/{source_id}/ 에 로컬 저장
 *   - HWPX 양식 파싱 → parsed.json 스킬화
 *   - Vercel 환경에서는 기존 Supabase Storage 사용 (호환성 유지)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllBizinfoPrograms } from "@/lib/apis/bizinfo";
import { fetchAllMssBizPrograms } from "@/lib/apis/mss-biz";
import { fetchAllKStartupPrograms } from "@/lib/apis/kstartup";
import { parseDateRange } from "@/lib/ai/prompts/matching";
import { runMatchingPipeline } from "@/lib/pipeline/matcher";
import { downloadAndCacheTemplate, extractFormUrls } from "@/lib/hwpx/template-manager";
import { buildFormSkill, hasExistingSkill } from "@/lib/pipeline/form-skill-builder";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";

/** 로컬 저장 루트 디렉토리 */
const PROGRAMS_DATA_DIR = join(process.cwd(), "data", "programs");

/** HTML 엔티티 디코딩 (API 원본 데이터에 &apos; 등이 포함됨) */
function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&") // &amp; 는 마지막에 처리
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

/** Vercel 환경 여부 (프로덕션에서는 로컬 저장 불가) */
const IS_VERCEL = !!process.env.VERCEL;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB attachment structure varies by source
  attachment_urls: Record<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw API response preserved as-is
  raw_data: Record<string, any>;
}

export async function collectAllPrograms(): Promise<{
  total: number;
  inserted: number;
  deduped: number;
  formsCached: number;
  formsSkilled: number;
  matching: { companyId: string; matched: number; skipped: number }[];
  errors: string[];
}> {
  const results: CollectedProgram[] = [];
  const errors: string[] = [];

  // 3개 소스 병렬 수집 (Vercel 300초 타임아웃 대비)
  const [bizinfoResult, mssResult, kstartupResult] = await Promise.allSettled([
    fetchAllBizinfoPrograms(),
    fetchAllMssBizPrograms(),
    fetchAllKStartupPrograms(),
  ]);

  // 1. 기업마당 (최대 3,000건)
  if (bizinfoResult.status === "fulfilled") {
    for (const item of bizinfoResult.value) {
      const dates = parseDateRange(item.apply_period || "");
      results.push({
        ...item,
        apply_start: dates.start,
        apply_end: dates.end,
      });
    }
    console.log(`[Collector] 기업마당: ${bizinfoResult.value.length}건`);
  } else {
    errors.push(`기업마당 수집 실패: ${bizinfoResult.reason}`);
    console.error("[Collector] 기업마당 오류:", bizinfoResult.reason);
  }

  // 2. 중소벤처기업부 (최대 5,000건)
  if (mssResult.status === "fulfilled") {
    results.push(...mssResult.value);
    console.log(`[Collector] 중소벤처기업부: ${mssResult.value.length}건`);
  } else {
    errors.push(`중소벤처기업부 수집 실패: ${mssResult.reason}`);
    console.error("[Collector] 중소벤처기업부 오류:", mssResult.reason);
  }

  // 3. K-Startup (최대 5,000건)
  if (kstartupResult.status === "fulfilled") {
    results.push(...kstartupResult.value);
    console.log(`[Collector] K-Startup: ${kstartupResult.value.length}건`);
  } else {
    errors.push(`K-Startup 수집 실패: ${kstartupResult.reason}`);
    console.error("[Collector] K-Startup 오류:", kstartupResult.reason);
  }

  // 소스 간 중복 제거 (제목+기관 기준, 먼저 수집된 소스 우선)
  const seen = new Map<string, number>();
  const deduped: CollectedProgram[] = [];
  for (let i = 0; i < results.length; i++) {
    const key = `${(results[i].title || "").trim().toLowerCase()}::${(results[i].institution || "").trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.set(key, i);
      deduped.push(results[i]);
    }
  }

  // DB UPSERT (배치 단위 — 성능 최적화)
  const supabase = createAdminClient();
  let inserted = 0;
  const BATCH_SIZE = 50;

  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const rows = batch.map((program) => ({
      source: program.source,
      source_id: program.source_id,
      title: decodeHtmlEntities(program.title),
      summary: decodeHtmlEntities(program.summary),
      target: decodeHtmlEntities(program.target),
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

  // === 양식폼 자동 캐싱 + 로컬 저장 + 스킬화 ===
  let formsCached = 0;
  let formsSkilled = 0;

  try {
    // attachment_urls에 양식이 있는 프로그램 조회 (source, source_id 포함)
    const { data: programsWithForms } = await supabase
      .from("programs")
      .select("id, source, source_id, title, attachment_urls, detail_url")
      .not("attachment_urls", "is", null);

    if (programsWithForms && programsWithForms.length > 0) {
      for (const prog of programsWithForms) {
        const urls = extractFormUrls(prog.attachment_urls as Record<string, unknown>);
        if (urls.length === 0) continue;

        try {
          // 1. Supabase Storage 캐싱 (기존 — 항상 실행, Vercel 호환)
          const tmpl = await downloadAndCacheTemplate(supabase, prog.id);
          if (tmpl && tmpl.status === "downloaded") formsCached++;

          // 2. 로컬 저장 (Vercel이 아닌 경우만)
          if (!IS_VERCEL) {
            const programDir = join(PROGRAMS_DATA_DIR, prog.source, prog.source_id);

            // 이미 로컬에 있으면 스킵
            if (!existsSync(join(programDir, "meta.json"))) {
              await saveAttachmentsLocally(
                programDir,
                prog,
                urls
              );
            }

            // 3. 스킬화 (parsed.json 없을 때만)
            if (!hasExistingSkill(programDir)) {
              try {
                const skill = await buildFormSkill(
                  programDir,
                  prog.id,
                  prog.source,
                  prog.source_id
                );
                if (skill) formsSkilled++;
              } catch (skillErr) {
                // 스킬화 실패는 무시 (다음 수집 시 재시도)
                console.warn(`[Collector] 스킬화 실패 [${prog.source_id}]:`, skillErr);
              }
            }
          }
        } catch {
          // 양식 캐싱 실패는 무시 (수집 파이프라인 중단하지 않음)
        }
      }
    }
  } catch (e) {
    console.warn("[Collector] 양식 캐싱/스킬화 단계 오류:", e);
  }

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
      for (const company of companies) {
        try {
          const result = await runMatchingPipeline(company.id);
          matchingResults.push({
            companyId: company.id,
            matched: result.matched,
            skipped: result.skipped,
          });
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

  return { total: results.length, inserted, deduped: deduped.length, formsCached, formsSkilled, matching: matchingResults, errors };
}

// ===== 로컬 파일 저장 =====

/**
 * 프로그램 첨부파일을 로컬 디렉토리에 저장
 * data/programs/{source}/{source_id}/ 구조로 저장
 */
async function saveAttachmentsLocally(
  programDir: string,
  program: {
    id: string;
    source: string;
    source_id: string;
    title: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSONB attachment structure varies by source
    attachment_urls: Record<string, any>;
    detail_url: string | null;
  },
  formUrls: string[]
): Promise<void> {
  // 디렉토리 생성
  mkdirSync(programDir, { recursive: true });

  // 첨부파일 다운로드
  for (const url of formUrls) {
    try {
      const response = await fetch(url, {
        redirect: "follow",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });

      if (!response.ok) {
        console.warn(`[Collector] 파일 다운로드 실패: ${response.status} ${url}`);
        continue;
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // 파일명 추출 (URL 또는 Content-Disposition에서)
      const fileName = extractFileName(url, response);
      const filePath = join(programDir, fileName);

      writeFileSync(filePath, buffer);
    } catch (err) {
      console.warn(`[Collector] 첨부파일 다운로드 실패: ${url}`, err);
    }
  }

  // meta.json 생성
  const meta = {
    programId: program.id,
    source: program.source,
    sourceId: program.source_id,
    title: program.title,
    detailUrl: program.detail_url,
    attachmentUrls: formUrls,
    collectedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(programDir, "meta.json"),
    JSON.stringify(meta, null, 2),
    "utf-8"
  );
}

/** URL 또는 Content-Disposition에서 파일명 추출 */
function extractFileName(url: string, response: Response): string {
  // Content-Disposition 헤더에서 추출 시도
  const disposition = response.headers.get("content-disposition");
  if (disposition) {
    // filename*=UTF-8''encoded_name
    const utf8Match = disposition.match(/filename\*=UTF-8''(.+)/i);
    if (utf8Match) {
      try {
        return decodeURIComponent(utf8Match[1]);
      } catch { /* fall through */ }
    }
    // filename="name" 또는 filename=name
    const filenameMatch = disposition.match(/filename[^;=\n]*=(?:(?:\"([^\"]*)\")|([\w\-_.가-힣]+))/i);
    if (filenameMatch) {
      return filenameMatch[1] || filenameMatch[2];
    }
  }

  // URL 경로에서 추출
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");
    const lastPart = pathParts[pathParts.length - 1];
    if (lastPart && lastPart.includes(".")) {
      return decodeURIComponent(lastPart);
    }
  } catch { /* fall through */ }

  // 기본 파일명
  const ext = url.toLowerCase().includes(".hwp") ? ".hwpx" : ".dat";
  return `form_${Date.now()}${ext}`;
}
