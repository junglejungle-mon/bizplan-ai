/**
 * AI 매칭 파이프라인 v3
 * 근거 기반 엄격 평가 + 심층분석 80점+ 기준
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import {
  REGION_MATCH_SYSTEM,
  buildRegionMatchPrompt,
  COMPANY_MATCH_SYSTEM,
  buildCompanyMatchPrompt,
  DEEP_ANALYSIS_SYSTEM,
  buildDeepAnalysisPrompt,
} from "@/lib/ai/prompts/matching";
import { sendKakaoNotification } from "@/lib/notification/notification-service";

interface MatchResult {
  programId: string;
  programTitle: string;
  regionMatch: boolean;
  matchScore: number;
  matchReason: string;
  matchKeywords: string[];
  matchDetail: string;
  scoreBreakdown: Record<string, number> | null;
  fitLevel: string;
}

/**
 * 특정 회사에 대해 모든 미매칭 프로그램을 분석
 */
export async function runMatchingPipeline(companyId: string): Promise<{
  matched: number;
  skipped: number;
  deepAnalyzed: number;
  errors: string[];
}> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  // 1. 회사 정보 로드
  const { data: company } = await supabase
    .from("companies")
    .select("*")
    .eq("id", companyId)
    .single();

  if (!company) {
    return { matched: 0, skipped: 0, deepAnalyzed: 0, errors: ["회사를 찾을 수 없습니다"] };
  }

  if (!company.business_content || company.profile_score < 20) {
    return {
      matched: 0,
      skipped: 0,
      deepAnalyzed: 0,
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

  // 3. 미매칭 프로그램 로드 (더 많이 가져오기)
  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .order("collected_at", { ascending: false })
    .limit(200);

  const unmatchedPrograms = (programs ?? []).filter(
    (p: any) => !matchedProgramIds.has(p.id)
  );

  if (unmatchedPrograms.length === 0) {
    return { matched: 0, skipped: 0, deepAnalyzed: 0, errors: [] };
  }

  const region = company.region || "서울, 경기";
  let matched = 0;
  let skipped = 0;
  let deepAnalyzed = 0;

  // 심층 분석 대상 수집 (80점 이상 — 핵심 추천 사업만)
  const deepAnalysisCandidates: Array<{
    companyId: string;
    programId: string;
    businessContent: string;
    programText: string;
  }> = [];

  // 4. 각 프로그램에 대해 매칭 분석
  for (const program of unmatchedPrograms) {
    try {
      // Step 1: 지역 매칭 (Haiku — 빠르고 저렴, 관대한 기준)
      const regionResult = await callClaude({
        model: "claude-haiku-4-5-20251001",
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
        maxTokens: 10,
      });

      const regionMatch = regionResult.trim().toLowerCase() === "true";

      if (!regionMatch) {
        skipped++;
        continue;
      }

      // Step 2: 적합성 분석 (Haiku — 빠르고 저렴, 엄격한 프롬프트로 품질 확보)
      const matchResult = await callClaude({
        model: "claude-haiku-4-5-20251001",
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
        maxTokens: 1500,
      });

      // JSON 파싱 (새 구조)
      let matchScore = 0;
      let matchReason = "";
      let matchKeywords: string[] = [];
      let matchDetail = "";
      let scoreBreakdown: Record<string, number> | null = null;
      let fitLevel = "참고";

      try {
        const jsonMatch = matchResult.match(
          /\{[\s\S]*"match_score"[\s\S]*\}/
        );
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          matchScore = parsed.match_score || 0;
          matchReason = parsed.match_reason || "";
          matchKeywords = parsed.match_keywords || [];
          matchDetail = parsed.match_detail || "";
          scoreBreakdown = parsed.score_breakdown || null;
          fitLevel = parsed.fit_level || "참고";
        }
      } catch {
        // JSON 파싱 실패 시 텍스트에서 점수 추출
        const scoreMatch = matchResult.match(/(\d{1,3})/);
        matchScore = scoreMatch ? parseInt(scoreMatch[1]) : 30;
        matchReason = matchResult.slice(0, 200);
      }

      const finalScore = Math.min(100, Math.max(0, matchScore));

      // Step 3: matchings 테이블에 저장 (확장된 필드)
      const { error } = await supabase.from("matchings").upsert(
        {
          company_id: companyId,
          program_id: program.id,
          match_score: finalScore,
          match_reason: matchReason,
          match_keywords: matchKeywords,
          match_detail: matchDetail,
          score_breakdown: scoreBreakdown,
          fit_level: fitLevel,
          region_match: regionMatch,
          status: "analyzed",
        },
        { onConflict: "company_id,program_id" }
      );

      if (error) {
        errors.push(`매칭 저장 실패 [${program.title}]: ${error.message}`);
      } else {
        matched++;

        // 80점 이상 → 심층 분석 후보 (핵심 추천만)
        if (finalScore >= 80) {
          const programText = [
            `공고명: ${program.title}`,
            program.summary ? `요약: ${program.summary}` : "",
            program.target ? `지원대상: ${program.target}` : "",
            program.institution ? `주관기관: ${program.institution}` : "",
            program.hashtags?.length ? `키워드: ${program.hashtags.join(", ")}` : "",
          ].filter(Boolean).join("\n");

          deepAnalysisCandidates.push({
            companyId,
            programId: program.id,
            businessContent: company.business_content,
            programText,
          });
        }
      }
    } catch (e) {
      errors.push(`매칭 분석 실패 [${program.title}]: ${e}`);
    }
  }

  // 5. 심층 분석 (80점 이상 매칭, 최대 10개)
  const deepTargets = deepAnalysisCandidates.slice(0, 10);
  for (const target of deepTargets) {
    try {
      const deepReport = await callClaude({
        model: "claude-sonnet-4-20250514",
        system: DEEP_ANALYSIS_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildDeepAnalysisPrompt(
              target.businessContent,
              target.programText
            ),
          },
        ],
        temperature: 0.3,
        maxTokens: 3000,
      });

      // deep_score 추출 (보고서에서)
      let deepScore: number | null = null;
      const scoreMatch = deepReport.match(/종합\s*점수[:\s]*(\d{1,3})/);
      if (scoreMatch) {
        deepScore = Math.min(100, Math.max(0, parseInt(scoreMatch[1])));
      }

      await supabase
        .from("matchings")
        .update({
          deep_report: deepReport,
          deep_score: deepScore,
        })
        .eq("company_id", target.companyId)
        .eq("program_id", target.programId);

      deepAnalyzed++;
    } catch (e) {
      errors.push(`심층 분석 실패: ${e}`);
    }
  }

  console.log(
    `[Matcher] 완료: ${matched}건 매칭, ${skipped}건 지역 스킵, ${deepAnalyzed}건 심층분석`
  );

  // 매칭 결과 카카오 알림톡 발송 (1건 이상 매칭 시)
  if (matched > 0) {
    try {
      // 최고 점수 조회
      const { data: topMatch } = await supabase
        .from("matchings")
        .select("match_score")
        .eq("company_id", companyId)
        .order("match_score", { ascending: false })
        .limit(1)
        .single();

      await sendKakaoNotification({
        userId: company.user_id,
        type: "matching",
        variables: {
          "#{회사명}": company.name,
          "#{매칭건수}": String(matched),
          "#{최고점수}": String(topMatch?.match_score ?? 0),
        },
      });
    } catch (e) {
      console.error("[Matcher] 알림 발송 실패:", e);
    }
  }

  return { matched, skipped, deepAnalyzed, errors };
}
