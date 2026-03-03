/**
 * K-Startup 사업정보 API (data.go.kr)
 * 기존 kstartup.ts (공고정보)와 다른 엔드포인트 — 예산, 지원내용, 대상 상세 등 풍부한 사업 정보
 * API: getBusinessInformation01
 */

interface KStartupBizItem {
  id: number;
  biz_yr: number; // 사업연도
  supt_biz_titl_nm: string; // 지원사업명
  supt_biz_intrd_info: string; // 사업 소개
  supt_biz_chrct: string; // 사업 특성
  biz_supt_trgt_info: string; // 지원 대상
  biz_supt_ctnt: string; // 지원 내용
  biz_supt_bdgt_info: string; // 예산/지원규모
  biz_category_cd: string; // 분류 코드
  detl_pg_url: string; // 상세페이지 URL
}

interface KStartupBizResponse {
  data?: KStartupBizItem[];
  currentCount?: number;
  totalCount?: number;
  matchCount?: number;
}

type KStartupBizResultItem = ReturnType<typeof mapKStartupBizItem>;

/**
 * 전체 사업정보 수집 (2025 + 2026년)
 * 페이지네이션 자동 순회
 */
export async function fetchAllKStartupBizPrograms(maxPages = 10) {
  const allItems: KStartupBizResultItem[] = [];
  const currentYear = new Date().getFullYear();

  // 올해 + 작년 데이터 수집
  for (const year of [currentYear, currentYear - 1]) {
    for (let page = 1; page <= maxPages; page++) {
      const items = await fetchKStartupBizPrograms(page, 500, year);
      allItems.push(...items);
      if (items.length < 500) break;
    }
  }

  return allItems;
}

function mapKStartupBizItem(item: KStartupBizItem) {
  // 해시태그 생성
  const hashtags: string[] = [];
  if (item.biz_category_cd) hashtags.push(item.biz_category_cd);
  if (item.biz_yr) hashtags.push(`${item.biz_yr}년`);

  // 지원내용에서 키워드 추출
  const content = item.biz_supt_ctnt || "";
  if (content.includes("자금")) hashtags.push("자금지원");
  if (content.includes("컨설팅") || content.includes("멘토링")) hashtags.push("컨설팅");
  if (content.includes("수출") || content.includes("글로벌")) hashtags.push("수출지원");
  if (content.includes("R&D") || content.includes("기술")) hashtags.push("기술개발");

  // 상세 URL 정규화
  let detailUrl = item.detl_pg_url || "";
  if (detailUrl && !detailUrl.startsWith("http")) {
    detailUrl = `https://${detailUrl}`;
  }

  return {
    source: "kstartup-biz" as const,
    source_id: `biz-${item.id}`,
    title: item.supt_biz_titl_nm,
    summary: [item.supt_biz_intrd_info, item.supt_biz_chrct]
      .filter(Boolean)
      .join(" — ")
      .slice(0, 500) || null,
    target: item.biz_supt_trgt_info || null,
    hashtags,
    apply_start: null as string | null,
    apply_end: null as string | null,
    institution: "창업진흥원" as string | null,
    detail_url: detailUrl || null,
    attachment_urls: {},
    raw_data: {
      ...item,
      budget_info: item.biz_supt_bdgt_info,
      support_content: item.biz_supt_ctnt,
    } as Record<string, unknown>,
  };
}

export async function fetchKStartupBizPrograms(page = 1, perPage = 100, year?: number) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY not set");

  const encodedKey = encodeURIComponent(serviceKey);
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    returnType: "json",
  });

  // 연도 필터 (있으면)
  if (year) {
    params.set("cond[biz_yr::EQ]", String(year));
  }

  const response = await fetch(
    `https://apis.data.go.kr/B552735/kisedKstartupService01/getBusinessInformation01?ServiceKey=${encodedKey}&${params}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
        Accept: "application/json",
      },
      cache: "no-store" as RequestCache,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `K-Startup Biz API error: ${response.status} — ${errorBody.substring(0, 200)}`
    );
  }

  const data: KStartupBizResponse = await response.json();
  const items = data.data ?? [];

  return items
    .filter((item) => item.supt_biz_titl_nm) // 사업명 없는 건 제외
    .map(mapKStartupBizItem);
}
