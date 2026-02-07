/**
 * K-Startup 창업넷 API (data.go.kr)
 * 창업넷 공고 정보
 */

interface KStartupItem {
  title: string; // 공고명
  dataContents: string; // 공고 내용
  pbancRcptBgngDt?: string;
  pbancRcptEndDt?: string;
  bizYr?: string;
  pbancNo?: string;
}

interface KStartupResponse {
  data?: KStartupItem[];
  currentCount?: number;
  totalCount?: number;
}

export async function fetchKStartupPrograms(page = 1, perPage = 100) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY not set");

  const currentYear = new Date().getFullYear().toString();

  const params = new URLSearchParams({
    ServiceKey: serviceKey,
    page: String(page),
    perPage: String(perPage),
    returnType: "json",
    biz_yr: currentYear,
    rcrt_prgs_yn: "Y",
  });

  const response = await fetch(
    `https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01?${params}`,
    {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    }
  );

  if (!response.ok) {
    throw new Error(`K-Startup API error: ${response.status}`);
  }

  const data: KStartupResponse = await response.json();
  const items = data.data ?? [];

  return items.map((item) => ({
    source: "kstartup" as const,
    source_id: item.pbancNo || item.title,
    title: item.title,
    summary: item.dataContents?.slice(0, 500),
    target: null,
    hashtags: [] as string[],
    apply_start: item.pbancRcptBgngDt || null,
    apply_end: item.pbancRcptEndDt || null,
    institution: "K-Startup",
    detail_url: null,
    attachment_urls: {},
    raw_data: item,
  }));
}
