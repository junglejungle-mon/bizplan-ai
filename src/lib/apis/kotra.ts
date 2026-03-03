/**
 * KOTRA 수출지원사업 크롤러
 * 내부 API: POST https://www.kotra.or.kr/bigdata/guide/getRctBusiness
 * 인증 불필요 (공개 API)
 */

interface KotraItem {
  bizId: string;
  bizSj: string; // 사업명
  bizCn: string | null; // 사업 내용
  rcritPdTxt: string; // 접수기간 (YYYY-MM-DD ~ YYYY-MM-DD)
  bizPdTxt: string | null; // 사업기간
  aplyPosblYn: string; // 접수가능 여부
  hostInsttName: string; // 주관기관
  bizAplyUrl: string; // 접수 URL
  bizKndName: string; // 사업 종류
  bizPblancOriginName: string; // 원본 출처
  remainDays: string; // 남은 일수
  natName: string | null; // 국가
  industName: string | null; // 업종
}

interface KotraResponse {
  totalCnt: number[];
  rctBusinessList: KotraItem[];
}

type KotraResultItem = ReturnType<typeof mapKotraItem>;

/**
 * 전체 KOTRA 수출지원사업 수집
 * 페이지네이션 자동 순회
 */
export async function fetchAllKotraPrograms(maxPages = 10) {
  const allItems: KotraResultItem[] = [];
  const PAGE_SIZE = 100;

  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchKotraPrograms(page, PAGE_SIZE);
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
  }
  return allItems;
}

function mapKotraItem(item: KotraItem) {
  // 접수기간 파싱 (YYYY-MM-DD ~ YYYY-MM-DD)
  let applyStart: string | null = null;
  let applyEnd: string | null = null;
  if (item.rcritPdTxt) {
    const parts = item.rcritPdTxt.split("~").map((s) => s.trim());
    if (parts[0] && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) applyStart = parts[0];
    if (parts[1] && /^\d{4}-\d{2}-\d{2}$/.test(parts[1])) applyEnd = parts[1];
  }

  // 해시태그
  const hashtags: string[] = ["수출지원"];
  if (item.bizKndName) hashtags.push(item.bizKndName);
  if (item.natName) hashtags.push(item.natName);
  if (item.industName) hashtags.push(item.industName);

  return {
    source: "kotra" as const,
    source_id: item.bizId,
    title: item.bizSj,
    summary: item.bizCn?.slice(0, 500) || null,
    target: null as string | null,
    hashtags,
    apply_start: applyStart,
    apply_end: applyEnd,
    institution: item.hostInsttName || "KOTRA",
    detail_url: item.bizAplyUrl || null,
    attachment_urls: {},
    raw_data: item as unknown as Record<string, unknown>,
  };
}

async function fetchKotraPrograms(page = 1, rowsPerPage = 100) {
  const response = await fetch(
    "https://www.kotra.or.kr/bigdata/guide/getRctBusiness",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
        Referer: "https://www.kotra.or.kr/bigdata/biz/supportBiz.do",
      },
      body: JSON.stringify({
        pageNo: page,
        rowsPerPage,
        searchBizName: "",
      }),
      cache: "no-store" as RequestCache,
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `KOTRA API error: ${response.status} — ${errorBody.substring(0, 200)}`
    );
  }

  const data: KotraResponse = await response.json();
  const items = data.rctBusinessList ?? [];

  return items
    .filter((item) => item.bizSj)
    .map(mapKotraItem);
}
