/**
 * AI 매칭 파이프라인 v4
 * 근거 기반 엄격 평가 + 배치 처리 (로컬 프록시 속도 최적화)
 */

import { createAdminClient } from "@/lib/supabase/admin";
import { callClaude } from "@/lib/ai/claude";
import {
  DEEP_ANALYSIS_SYSTEM,
  buildDeepAnalysisPrompt,
} from "@/lib/ai/prompts/matching";
import { sendKakaoNotification } from "@/lib/notification/notification-service";

/**
 * 배치 지역 매칭: 한번의 AI 호출로 여러 프로그램의 지역 적합성 판단
 */
async function batchRegionMatch(
  region: string,
  programs: Array<{ id: string; title: string; hashtags?: string[]; summary?: string }>
): Promise<Set<string>> {
  const passedIds = new Set<string>();

  // 프로그램 목록을 텍스트로 구성
  const programList = programs.map((p, i) =>
    `[${i}] ${p.title} | ${(p.hashtags || []).join(",")} | ${(p.summary || "").slice(0, 80)}`
  ).join("\n");

  const result = await callClaude({
    model: "claude-haiku-4-5-20251001",
    system: `당신은 지역 매칭 판단 전문가입니다.

회사 소재지와 각 지원사업의 지역 제한을 비교합니다.

## 판단 기준
- 전국 사업이거나 지역 제한 없으면 → PASS
- 공고 제목에 회사 소재지가 포함되면 → PASS
- 공고 제목에 다른 지역([부산], [충남], [경북] 등)이 명시되면 → FAIL
- 지역 불명확한 중앙부처 사업 → PASS

## 출력 형식
통과하는 프로그램의 번호만 쉼표로 나열하세요.
예: 0,1,3,5,7

통과하는 것이 없으면 "NONE"`,
    messages: [{
      role: "user",
      content: `회사 소재지: ${region}\n\n프로그램 목록:\n${programList}`,
    }],
    temperature: 0,
    maxTokens: 2000,
  });

  if (result.trim() === "NONE") return passedIds;

  // 번호 파싱
  const nums = result.match(/\d+/g);
  if (nums) {
    for (const n of nums) {
      const idx = parseInt(n);
      if (idx >= 0 && idx < programs.length) {
        passedIds.add(programs[idx].id);
      }
    }
  }

  return passedIds;
}

/**
 * 배치 적합성 분석: 여러 프로그램을 한번의 AI 호출로 분석
 */
async function batchCompanyMatch(
  businessContent: string,
  programs: Array<{ id: string; title: string; summary?: string; target?: string; hashtags?: string[] }>
): Promise<Map<string, { score: number; reason: string; keywords: string[]; detail: string; breakdown: Record<string, number> | null; fitLevel: string }>> {
  const results = new Map<string, { score: number; reason: string; keywords: string[]; detail: string; breakdown: Record<string, number> | null; fitLevel: string }>();

  const programList = programs.map((p, i) => {
    const parts = [
      `### 공고 [${i}]: ${p.title}`,
      `내용: ${(p.summary || "정보 없음").slice(0, 400)}`,
      `대상: ${p.target || "제한 없음"}`,
      `키워드: ${(p.hashtags || []).join(", ") || "없음"}`,
    ];
    // raw_data에서 추가 자격요건/지원분야 정보 추출
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = (p as { raw_data?: Record<string, any> }).raw_data;
    if (raw) {
      if (raw.support_detail || raw.지원내용) {
        parts.push(`지원내용: ${(raw.support_detail || raw.지원내용 || "").slice(0, 200)}`);
      }
    }
    return parts.join("\n");
  }).join("\n\n");

  const result = await callClaude({
    model: "claude-haiku-4-5-20251001",
    system: `정부지원사업 매칭 전문가. 회사와 공고 적합도를 0~100점으로 평가.

핵심: 업종/분야 불일치→60점 이하. 일반 중소기업 대상→최대 50점.
80+: 핵심분야 정확 일치, 60-79: 관련성 높음, 40-59: 간접관련, 20-39: 참고, 0-19: 부적합.

JSON 배열만 출력 (설명 없이):
[{"idx":0,"score":N,"reason":"사유","keywords":["k1"],"fit":"레벨"}]`,
    messages: [{
      role: "user",
      content: `## 회사\n${businessContent.slice(0, 1500)}\n\n## 공고 ${programs.length}건\n${programList}`,
    }],
    temperature: 0.1,
    maxTokens: 2048,
  });

  // JSON 배열 파싱
  let parseFailed = false;
  try {
    const jsonMatch = result.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const item of parsed) {
        const idx = item.idx;
        if (idx >= 0 && idx < programs.length) {
          const score = Math.min(100, Math.max(0, item.score || 0));
          // fit_level과 score 일관성 강제 (AI가 score와 fit 불일치할 때 보정)
          let fitLevel = item.fit || "참고";
          if (score >= 80) fitLevel = "매우적합";
          else if (score >= 60) fitLevel = "적합";
          else if (score >= 40) fitLevel = "검토추천";
          else if (score >= 20) fitLevel = "참고";
          else fitLevel = "부적합";

          results.set(programs[idx].id, {
            score,
            reason: item.reason || "",
            keywords: item.keywords || [],
            detail: item.detail || "",
            breakdown: item.breakdown || null,
            fitLevel,
          });
        }
      }
    } else {
      console.warn("[Matcher] JSON 배열 없음, 응답:", result.slice(0, 200));
      parseFailed = true;
    }
  } catch (e) {
    console.warn("[Matcher] JSON 파싱 에러:", e, "응답:", result.slice(0, 200));
    parseFailed = true;
  }

  // 배치 파싱 실패 시 개별 분석 fallback
  if (parseFailed || results.size === 0) {
    console.warn(`[Matcher] 배치 파싱 실패, ${programs.length}개 개별 분석 시작`);
    for (const p of programs) {
      if (results.has(p.id)) continue; // 이미 파싱된 건 스킵
      try {
        const singleResult = await callClaude({
          model: "claude-haiku-4-5-20251001",
          system: `정부지원사업 매칭 전문가. 회사와 공고의 적합도를 0~100점으로 평가.
업종/분야가 직접 관련 없으면 60점 이하. 일반 중소기업 대상 사업은 최대 50점.
JSON만 출력: {"score":N,"reason":"사유","keywords":["k1"],"fit":"레벨"}
fit: 80+→매우적합, 60-79→적합, 40-59→검토추천, 20-39→참고, 0-19→부적합`,
          messages: [{
            role: "user",
            content: `## 회사\n${businessContent.slice(0, 1500)}\n\n## 공고: ${p.title}\n내용: ${(p.summary || "").slice(0, 300)}\n대상: ${p.target || "제한없음"}\n키워드: ${(p.hashtags || []).join(", ") || "없음"}`,
          }],
          temperature: 0.1,
          maxTokens: 512,
        });

        const jm = singleResult.match(/\{[\s\S]*\}/);
        if (jm) {
          const item = JSON.parse(jm[0]);
          const score = Math.min(100, Math.max(0, item.score || 0));
          let fitLevel = item.fit || "참고";
          if (score >= 80) fitLevel = "매우적합";
          else if (score >= 60) fitLevel = "적합";
          else if (score >= 40) fitLevel = "검토추천";
          else if (score >= 20) fitLevel = "참고";
          else fitLevel = "부적합";

          results.set(p.id, {
            score,
            reason: item.reason || "",
            keywords: item.keywords || [],
            detail: "",
            breakdown: null,
            fitLevel,
          });
        }
      } catch (e) {
        console.error(`[Matcher] 개별 분석 실패 [${p.title?.slice(0, 30)}]:`, e);
      }
    }
  }

  return results;
}

/**
 * 특정 회사에 대해 모든 미매칭 프로그램을 분석 (배치 최적화)
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
    (existingMatchings ?? []).map((m: { program_id: string }) => m.program_id)
  );

  // 3. 미매칭 + 마감 안 된 + 최근 수집 프로그램 로드
  const today = new Date().toISOString().split("T")[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString().split("T")[0];

  const { data: programs } = await supabase
    .from("programs")
    .select("*")
    .or(`apply_end.is.null,apply_end.gte.${today}`)
    .gte("collected_at", oneMonthAgo)
    .order("collected_at", { ascending: false })
    .limit(200);

  const unmatchedPrograms = (programs ?? []).filter(
    (p) => !matchedProgramIds.has(p.id)
  );

  if (unmatchedPrograms.length === 0) {
    return { matched: 0, skipped: 0, deepAnalyzed: 0, errors: [] };
  }

  const region = company.region || "서울, 경기";
  let matched = 0;
  let skipped = 0;
  let deepAnalyzed = 0;

  // ========================================
  // Step 1: 배치 지역 매칭 (50개씩 묶어서)
  // ========================================
  const regionPassedIds = new Set<string>();
  const REGION_BATCH_SIZE = 50;

  for (let i = 0; i < unmatchedPrograms.length; i += REGION_BATCH_SIZE) {
    const batch = unmatchedPrograms.slice(i, i + REGION_BATCH_SIZE);
    try {
      const passed = await batchRegionMatch(region, batch);
      passed.forEach((id) => regionPassedIds.add(id));
    } catch (e) {
      errors.push(`지역 매칭 배치 실패: ${e}`);
      // fallback: 배치 실패 시 모두 통과 처리
      for (const p of batch) {
        regionPassedIds.add(p.id);
      }
    }
  }

  const regionPassedPrograms = unmatchedPrograms.filter((p) => regionPassedIds.has(p.id));
  skipped = unmatchedPrograms.length - regionPassedPrograms.length;


  // ========================================
  // Step 2: 배치 적합성 분석 (5개씩 묶어서)
  // ========================================
  const MATCH_BATCH_SIZE = 3;
  const deepAnalysisCandidates: Array<{
    companyId: string;
    programId: string;
    businessContent: string;
    programText: string;
  }> = [];

  for (let i = 0; i < regionPassedPrograms.length; i += MATCH_BATCH_SIZE) {
    const batch = regionPassedPrograms.slice(i, i + MATCH_BATCH_SIZE);

    try {
      const batchResults = await batchCompanyMatch(company.business_content, batch);

      for (const program of batch) {
        const result = batchResults.get(program.id);
        if (!result) continue;

        const { error } = await supabase.from("matchings").upsert(
          {
            company_id: companyId,
            program_id: program.id,
            match_score: result.score,
            match_reason: result.reason,
            match_keywords: result.keywords,
            match_detail: result.detail,
            score_breakdown: result.breakdown,
            fit_level: result.fitLevel,
            region_match: true,
            status: "analyzed",
          },
          { onConflict: "company_id,program_id" }
        );

        if (error) {
          errors.push(`매칭 저장 실패 [${program.title}]: ${error.message}`);
        } else {
          matched++;

          if (result.score >= 80) {
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
      }
    } catch (e) {
      errors.push(`적합성 분석 배치 실패: ${e}`);
    }
  }


  // ========================================
  // Step 3: 심층 분석 (80점 이상, 최대 10개)
  // ========================================
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

  // 매칭 결과 카카오 알림톡 발송 (1건 이상 매칭 시)
  if (matched > 0) {
    try {
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
