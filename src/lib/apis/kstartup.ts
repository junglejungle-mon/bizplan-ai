/**
 * K-Startup 창업넷 API (data.go.kr)
 * 창업넷 공고 정보
 */

interface KStartupItem {
  biz_pbanc_nm: string; // 사업공고명
  intg_pbanc_biz_nm: string; // 통합공고 사업명
  pbanc_ctnt: string; // 공고 내용
  aply_trgt: string; // 지원 대상
  aply_trgt_ctnt: string; // 지원 대상 상세
  pbanc_rcpt_bgng_dt: string; // 접수시작일 (YYYYMMDD)
  pbanc_rcpt_end_dt: string; // 접수종료일 (YYYYMMDD)
  pbanc_sn: number; // 공고 일련번호
  pbanc_ntrp_nm: string; // 공고 기관명
  sprv_inst: string; // 주관기관
  supt_biz_clsfc: string; // 지원사업 분류
  supt_regin: string; // 지원 지역
  detl_pg_url: string; // 상세 페이지 URL
  biz_enyy: string; // 사업 연차
  biz_trgt_age: string; // 대상 연령
}

interface KStartupResponse {
  data?: KStartupItem[];
  currentCount?: number;
  totalCount?: number;
}

type KStartupResultItem = Awaited<ReturnType<typeof fetchKStartupPrograms>>[number];

/**
 * 전체 페이지 수집 (페이지네이션 자동 순회)
 * K-Startup은 데이터가 많으므로 perPage=500으로 큰 단위 수집
 * maxPages: 최대 순회 페이지 수 (기본 5 = 최대 2,500건)
 */
export async function fetchAllKStartupPrograms(maxPages = 5) {
  const allItems: KStartupResultItem[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchKStartupPrograms(page, 500);
    allItems.push(...items);
    console.log(`[K-Startup] 페이지 ${page}: ${items.length}건 (누적 ${allItems.length}건)`);
    if (items.length < 500) break; // 마지막 페이지
  }
  return allItems;
}

export async function fetchKStartupPrograms(page = 1, perPage = 100) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY not set");

  const currentYear = new Date().getFullYear().toString();

  // data.go.kr 서비스키는 URLSearchParams가 이중 인코딩하므로 직접 URL에 삽입
  const encodedKey = encodeURIComponent(serviceKey);
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage),
    returnType: "json",
    biz_yr: currentYear,
    rcrt_prgs_yn: "Y",
  });

  const response = await fetch(
    `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?ServiceKey=${encodedKey}&${params}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
        "Accept": "application/json",
      },
      cache: "no-store" as RequestCache,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `K-Startup API error: ${response.status} — ${errorBody.substring(0, 200)}`
    );
  }

  const data: KStartupResponse = await response.json();
  const items = data.data ?? [];

  return items
    .filter((item) => item.biz_pbanc_nm || item.intg_pbanc_biz_nm) // title 없는 건 제외
    .map((item) => {
      // 날짜 포맷 변환: YYYYMMDD → YYYY-MM-DD
      const formatDate = (d: string | null | undefined) => {
        if (!d || d.length !== 8) return null;
        return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
      };

      // 해시태그 생성
      const hashtags: string[] = [];
      if (item.supt_biz_clsfc) hashtags.push(item.supt_biz_clsfc);
      if (item.supt_regin) hashtags.push(item.supt_regin);
      if (item.biz_enyy) {
        item.biz_enyy.split(",").forEach((t) => hashtags.push(t.trim()));
      }

      return {
        source: "kstartup" as const,
        source_id: String(item.pbanc_sn) || item.biz_pbanc_nm,
        title: item.biz_pbanc_nm || item.intg_pbanc_biz_nm,
        summary: item.pbanc_ctnt?.slice(0, 500) || null,
        target: item.aply_trgt_ctnt || item.aply_trgt || null,
        hashtags,
        apply_start: formatDate(item.pbanc_rcpt_bgng_dt),
        apply_end: formatDate(item.pbanc_rcpt_end_dt),
        institution: item.pbanc_ntrp_nm || item.sprv_inst || "K-Startup",
        detail_url: item.detl_pg_url || null,
        attachment_urls: {},
        raw_data: item as unknown as Record<string, any>,
      };
    });
}
