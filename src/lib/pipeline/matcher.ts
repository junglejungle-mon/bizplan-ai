/**
 * AI 매칭 파이프라인
 * 수집된 programs ↔ 회사 프로필 매칭 분석
 */

import { createClient } from "@/lib/supabase/server";
import { callClaude } from "@/lib/ai/claude";
import {
  REGION_MATCH_SYSTEM,
  buildRegionMatchPrompt,
  COMPANY_MATCH_SYSTEM,
  buildCompanyMatchPrompt,
} from "@/lib/ai/prompts/matching";

interface MatchResult {
  programId: string;
  programTitle: string;
  regionMatch: boolean;
  matchScore: number;
  matchReason: string;
}

/**
 * 특정 회사에 대해 모든 미매칭 프로그램을 분석
 */
export async function runMatchingPipeline(companyId: string): Promise<{
  matched: number;
  skipped: number;
  errors: string[];
}> {
  const supabase = await createClient();
  const errors: string[] = [];

  // 1. 회사 정보 로드
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) {
    return { matched: 0, skipped: 0, errors: ["회사를 찾을 수 없습니다"] };
  }

  if (!company.business_content || company.profile_score < 20) {
    return {
      matched: 0,
      skipped: 0,
      errors: ["프로필이 충분하지 않습니다. AI 인터뷰를 먼저 진행해주세요."],
    };
  }

  // 2. 이미 매칭된 프로그램 ID 목록
  const { data: existingMatchings } = await supabase
    .from("matchings")
    .select("program_id")
    .eq("company_id", companyId);

  const matchedProgramIds = new Set(
    (existingMatchings ?? []).map((m: any) => m.program_id)
  );

  // 3. 미매칭 프로그램 로드
  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(100);

  const unmatchedPrograms = (programs ?? []).filter(
    (p: any) => !matchedProgramIds.has(p.id)
  );

  if (unmatchedPrograms.length === 0) {
    return { matched: 0, skipped: 0, errors: [] };
  }

  const region = company.region || "서울, 경기";
  let matched = 0;
  let skipped = 0;

  // 4. 각 프로그램에 대해 매칭 분석
  for (const program of unmatchedPrograms) {
    try {
      // Step 1: 지역 매칭 (Haiku — 빠르고 저렴)
      const regionResult = await callClaude({
        model: "claude-3-5-haiku-20241022",
        system: REGION_MATCH_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildRegionMatchPrompt(
              region,
              program.title,
              (program.hashtags || []).join(", "),
              program.summary || ""
            ),
          },
        ],
        temperature: 0,
      });

      const regionMatch = regionResult.trim().toLowerCase() === "true";

      if (!regionMatch) {
        skipped++;
        continue;
      }

      // Step 2: 적합성 분석 (Sonnet — 0-100점)
      const matchResult = await callClaude({
        model: "claude-sonnet-4-20250514",
        system: COMPANY_MATCH_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildCompanyMatchPrompt(
              company.business_content,
              program.title,
              program.summary || "",
              program.target || "",
              (program.hashtags || []).join(", ")
            ),
          },
        ],
        temperature: 0.3,
      });

      // JSON 파싱
      let matchScore = 0;
      let matchReason = "";

      try {
        const jsonMatch = matchResult.match(
          /\{[\s\S]*"match_score"[\s\S]*\}/
        );
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          matchScore = parsed.match_score || 0;
          matchReason = parsed.match_reason || "";
        }
      } catch {
        // JSON 파싱 실패 시 텍스트에서 점수 추출 시도
        const scoreMatch = matchResult.match(/(\d{1,3})/);
        matchScore = scoreMatch ? parseInt(scoreMatch[1]) : 30;
        matchReason = matchResult.slice(0, 200);
      }

      // Step 3: matchings 테이블에 저장
      const { error } = await supabase.from("matchings").upsert(
        {
          company_id: companyId,
          program_id: program.id,
          match_score: Math.min(100, Math.max(0, matchScore)),
          match_reason: matchReason,
          region_match: regionMatch,
          status: "analyzed",
        },
        { onConflict: "company_id,program_id" }
      );

      if (error) {
        errors.push(`매칭 저장 실패 [${program.title}]: ${error.message}`);
      } else {
        matched++;
      }
    } catch (e) {
      errors.push(`매칭 분석 실패 [${program.title}]: ${e}`);
    }
  }

  console.log(
    `[Matcher] 완료: ${matched}건 매칭, ${skipped}건 지역불일치 스킵`
  );

  return { matched, skipped, errors };
}
