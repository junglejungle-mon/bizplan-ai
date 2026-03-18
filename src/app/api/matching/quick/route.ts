import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendKakaoNotification } from "@/lib/notification/notification-service";
import { rateLimitAsync, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";

/**
 * POST /api/matching/quick
 * 간편 매칭 API — 회원가입 직후 업종/지역 기반 DB 쿼리 매칭 (AI 없이)
 * 인터뷰 전이라도 즉시 추천 결과를 제공하여 "가입 즉시 가치 제공"
 */
export async function POST(request: NextRequest) {
  // 매칭 남용 방지: 분당 5회 제한
  const ip = getClientIP(request);
  const rl = await rateLimitAsync(`matching-quick:${ip}`, RATE_LIMITS.AI_GENERATE);
  if (!rl.success) return rateLimitResponse(rl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { companyId } = await request.json();

  if (!companyId) {
    return Response.json({ error: "companyId required" }, { status: 400 });
  }

  // 회사 소유자 확인 + 프로필 정보 조회
  const adminSupabase = createAdminClient();
  const { data: company } = await adminSupabase
    .from("companies")
    .select("id, user_id, name, industry, region, employee_count")
    .eq("id", companyId)
    .single();

  if (!company || company.user_id !== user.id) {
    return Response.json({ error: "Company not found" }, { status: 404 });
  }

  // 업종/지역 정보가 둘 다 없으면 매칭 불가
  if (!company.industry && !company.region) {
    return Response.json({
      success: true,
      matched: 0,
      message: "업종/지역 정보가 없어 간편 매칭을 건너뜁니다",
    });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // 마감되지 않은 최근 프로그램 조회
    const { data: programs } = await adminSupabase
      .from("programs")
      .select("id, title, summary, target, hashtags, institution, apply_end, detail_url")
      .or(`apply_end.is.null,apply_end.gte.${today}`)
      .gte("collected_at", twoMonthsAgo)
      .order("collected_at", { ascending: false })
      .limit(300);

    if (!programs || programs.length === 0) {
      return Response.json({ success: true, matched: 0, message: "매칭 가능한 프로그램이 없습니다" });
    }

    // 키워드 기반 간편 매칭 점수 계산
    const region = company.region || "";
    const industry = company.industry || "";

    // 업종별 관련 키워드 매핑
    const industryKeywords = getIndustryKeywords(industry);

    interface MatchCandidate {
      programId: string;
      score: number;
      reason: string;
      keywords: string[];
      regionMatch: boolean;
    }

    const matchCandidates: MatchCandidate[] = [];

    for (const program of programs) {
      let score = 0;
      const reasons: string[] = [];
      const matchedKeywords: string[] = [];
      let regionMatch = false;

      const titleLower = (program.title || "").toLowerCase();
      const summaryLower = (program.summary || "").toLowerCase();
      const targetLower = (program.target || "").toLowerCase();
      const hashtagsStr = (program.hashtags || []).join(" ").toLowerCase();
      const fullText = `${titleLower} ${summaryLower} ${targetLower} ${hashtagsStr}`;

      // 1. 지역 매칭 (최대 25점)
      if (region) {
        // 프로그램 제목에 특정 지역이 명시되어 있으면
        const regionPatterns = ["서울", "경기", "인천", "부산", "대구", "광주", "대전", "울산", "세종", "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주"];
        const mentionedRegions = regionPatterns.filter(r => titleLower.includes(r));

        if (mentionedRegions.length > 0) {
          // 제목에 지역 명시 → 해당 지역이어야 매칭
          if (mentionedRegions.includes(region)) {
            score += 25;
            regionMatch = true;
            reasons.push(`${region} 지역 대상`);
            matchedKeywords.push(region);
          } else {
            // 다른 지역 한정 사업 → 스킵
            continue;
          }
        } else {
          // 지역 미명시 (전국 사업) → 기본 점수
          score += 15;
          regionMatch = true;
          reasons.push("전국 대상");
        }
      } else {
        // 지역 미입력 → 전국 사업만 기본 점수
        score += 10;
        regionMatch = true;
      }

      // 2. 업종 매칭 (최대 40점)
      if (industry && industryKeywords.length > 0) {
        let industryScore = 0;
        for (const keyword of industryKeywords) {
          if (fullText.includes(keyword.toLowerCase())) {
            industryScore += 10;
            matchedKeywords.push(keyword);
          }
        }
        industryScore = Math.min(40, industryScore);

        if (industryScore > 0) {
          score += industryScore;
          reasons.push(`${industry} 관련`);
        }
      }

      // 3. 일반 중소기업/스타트업 대상 사업 보너스 (최대 15점)
      const generalKeywords = ["중소기업", "소상공인", "스타트업", "창업", "벤처", "예비창업"];
      for (const kw of generalKeywords) {
        if (fullText.includes(kw)) {
          score += 5;
          matchedKeywords.push(kw);
        }
      }
      score = Math.min(score, 80); // 간편 매칭은 최대 80점 상한

      // 최소 점수 기준 (30점 이상만 추천)
      if (score >= 30) {
        matchCandidates.push({
          programId: program.id,
          score,
          reason: reasons.join(", ") || "일반 지원사업",
          keywords: [...new Set(matchedKeywords)],
          regionMatch,
        });
      }
    }

    // 점수 내림차순 정렬, 상위 10건
    matchCandidates.sort((a, b) => b.score - a.score);
    const topMatches = matchCandidates.slice(0, 10);

    if (topMatches.length === 0) {
      return Response.json({
        success: true,
        matched: 0,
        message: "간편 매칭 결과가 없습니다. AI 인터뷰 후 정밀 매칭을 시도해보세요.",
      });
    }

    // matchings 테이블에 저장
    let saved = 0;
    for (const match of topMatches) {
      const fitLevel =
        match.score >= 60 ? "적합" :
        match.score >= 40 ? "검토추천" : "참고";

      const { error } = await adminSupabase.from("matchings").upsert(
        {
          company_id: companyId,
          program_id: match.programId,
          match_score: match.score,
          match_reason: `[간편매칭] ${match.reason}`,
          match_keywords: match.keywords,
          match_detail: "간편 매칭 결과입니다. AI 인터뷰 완료 후 정밀 분석이 진행됩니다.",
          score_breakdown: null,
          fit_level: fitLevel,
          region_match: match.regionMatch,
          status: "quick_matched",
        },
        { onConflict: "company_id,program_id" }
      );

      if (!error) saved++;
    }

    // 카카오 알림톡 발송 (1건 이상 매칭 시)
    if (saved > 0) {
      try {
        await sendKakaoNotification({
          userId: company.user_id,
          type: "matching",
          variables: {
            "#{회원이름}": company.name,
            "#{공고명}": `외 ${saved}건 매칭`,
            "#{매칭점수}": String(topMatches[0]?.score ?? 0),
            "#{마감일}": "상세페이지 확인",
            "#{링크}": "https://bizplanai.co.kr/programs",
          },
        });
      } catch (e) {
        console.error("[QuickMatch] 알림톡 발송 실패:", e);
        // 알림 실패해도 매칭은 성공
      }
    }

    return Response.json({
      success: true,
      matched: saved,
      topScore: topMatches[0]?.score ?? 0,
      message: `${saved}건의 지원사업이 매칭되었습니다`,
    });
  } catch (error) {
    console.error("[QuickMatch] 간편 매칭 실패:", error);
    return Response.json(
      { success: false, error: "처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 업종별 관련 키워드 목록
 */
function getIndustryKeywords(industry: string): string[] {
  const map: Record<string, string[]> = {
    "IT/소프트웨어": ["IT", "소프트웨어", "SW", "ICT", "디지털", "AI", "인공지능", "클라우드", "SaaS", "플랫폼", "앱", "데이터", "보안"],
    "제조업": ["제조", "생산", "공장", "스마트팩토리", "자동화", "소재", "부품", "장비"],
    "바이오/헬스케어": ["바이오", "헬스케어", "의료", "제약", "건강", "디지털헬스", "진단", "치료"],
    "유통/물류": ["유통", "물류", "배송", "이커머스", "온라인쇼핑", "풀필먼트", "공급망"],
    "콘텐츠/미디어": ["콘텐츠", "미디어", "영상", "방송", "게임", "엔터테인먼트", "웹툰", "OTT"],
    "교육/에듀테크": ["교육", "에듀테크", "이러닝", "학습", "훈련", "직업훈련", "인재양성"],
    "금융/핀테크": ["금융", "핀테크", "결제", "보험", "투자", "블록체인", "가상자산"],
    "식품/외식": ["식품", "외식", "음식", "요리", "농식품", "프랜차이즈", "급식"],
    "농업/수산업": ["농업", "수산", "축산", "스마트팜", "어업", "농촌", "6차산업"],
    "에너지/환경": ["에너지", "환경", "친환경", "탄소", "신재생", "태양광", "ESG", "그린"],
    "건설/부동산": ["건설", "부동산", "건축", "인테리어", "프롭테크", "주택"],
    "관광/여행": ["관광", "여행", "숙박", "호텔", "관광지", "레저", "문화"],
    "사회적기업": ["사회적기업", "사회적경제", "소셜벤처", "마을기업", "협동조합", "자활"],
    "기타": [],
  };

  return map[industry] || [];
}
