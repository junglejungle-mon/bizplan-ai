/**
 * UTM 파라미터 추적 유틸리티
 * - 랜딩 시 UTM 파라미터 캡처 → sessionStorage 저장
 * - 회원가입 시 UTM 데이터 DB 저장 (user_metadata)
 * - 마케팅 채널별 전환 분석 지원
 */

export interface UTMData {
  utm_source?: string;    // 유입 소스 (google, naver, kakao, referral)
  utm_medium?: string;    // 매체 (cpc, organic, social, email)
  utm_campaign?: string;  // 캠페인 (spring_launch, gov_subsidy)
  utm_term?: string;      // 검색 키워드
  utm_content?: string;   // 광고 콘텐츠 구분 (banner_a, cta_hero)
  referrer?: string;      // document.referrer
  landing_page?: string;  // 최초 랜딩 URL
  captured_at?: string;   // 캡처 시점
}

const UTM_STORAGE_KEY = "bizplan_utm";
const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const;

/**
 * URL에서 UTM 파라미터를 추출하여 sessionStorage에 저장
 * 이미 저장된 UTM이 없을 때만 저장 (첫 터치 기준)
 */
export function captureUTM(): UTMData | null {
  if (typeof window === "undefined") return null;

  // 이미 UTM이 캡처된 세션이면 기존 값 반환
  const existing = getStoredUTM();
  if (existing) return existing;

  const params = new URLSearchParams(window.location.search);
  const utmData: UTMData = {};
  let hasUTM = false;

  for (const key of UTM_PARAMS) {
    const val = params.get(key);
    if (val) {
      utmData[key] = val;
      hasUTM = true;
    }
  }

  // UTM 없어도 referrer 정보는 저장
  utmData.referrer = document.referrer || "";
  utmData.landing_page = window.location.pathname + window.location.search;
  utmData.captured_at = new Date().toISOString();

  // referrer에서 자동으로 utm_source 추론
  if (!utmData.utm_source && utmData.referrer) {
    utmData.utm_source = inferSourceFromReferrer(utmData.referrer);
    if (utmData.utm_source) {
      utmData.utm_medium = utmData.utm_medium || "organic";
      hasUTM = true;
    }
  }

  // 추천 코드 파라미터가 있으면 referral로 표시
  const ref = params.get("ref");
  if (ref) {
    utmData.utm_source = utmData.utm_source || "referral";
    utmData.utm_medium = utmData.utm_medium || "referral";
    utmData.utm_campaign = utmData.utm_campaign || `ref_${ref}`;
    hasUTM = true;
  }

  if (hasUTM || utmData.referrer) {
    try {
      sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmData));
    } catch {
      // sessionStorage 접근 불가 (private browsing 등)
    }
    return utmData;
  }

  return null;
}

/**
 * sessionStorage에서 저장된 UTM 데이터 조회
 */
export function getStoredUTM(): UTMData | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
    if (stored) return JSON.parse(stored) as UTMData;
  } catch {
    // ignore
  }
  return null;
}

/**
 * UTM 데이터 삭제 (가입 완료 후)
 */
export function clearUTM(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(UTM_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Referrer URL에서 유입 소스 추론
 */
function inferSourceFromReferrer(referrer: string): string | undefined {
  try {
    const hostname = new URL(referrer).hostname.toLowerCase();

    if (hostname.includes("google")) return "google";
    if (hostname.includes("naver")) return "naver";
    if (hostname.includes("daum") || hostname.includes("kakao")) return "kakao";
    if (hostname.includes("bing")) return "bing";
    if (hostname.includes("facebook") || hostname.includes("fb")) return "facebook";
    if (hostname.includes("instagram")) return "instagram";
    if (hostname.includes("twitter") || hostname.includes("x.com")) return "twitter";
    if (hostname.includes("linkedin")) return "linkedin";
    if (hostname.includes("youtube")) return "youtube";
    if (hostname.includes("blog.naver")) return "naver_blog";
    if (hostname.includes("tistory")) return "tistory";
    if (hostname.includes("brunch")) return "brunch";

    // 자사 도메인이면 무시
    if (hostname.includes("bizplanai.co.kr")) return undefined;

    return hostname; // 기타 외부 사이트는 도메인 그대로
  } catch {
    return undefined;
  }
}

/**
 * 마케팅 캠페인용 UTM 링크 생성
 */
export function buildUTMLink(
  baseUrl: string,
  params: {
    source: string;
    medium: string;
    campaign: string;
    term?: string;
    content?: string;
  }
): string {
  const url = new URL(baseUrl);
  url.searchParams.set("utm_source", params.source);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);
  if (params.term) url.searchParams.set("utm_term", params.term);
  if (params.content) url.searchParams.set("utm_content", params.content);
  return url.toString();
}

/**
 * 추천 + UTM 결합 링크 생성 (카카오톡 공유 등)
 */
export function buildReferralUTMLink(
  referralCode: string,
  shareChannel: "kakao" | "link" | "copy" | "other" = "link"
): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bizplanai.co.kr";
  return buildUTMLink(`${baseUrl}/signup`, {
    source: "referral",
    medium: shareChannel === "kakao" ? "kakao" : "referral",
    campaign: `ref_${referralCode}`,
    content: shareChannel,
  }) + `&ref=${referralCode}`;
}
