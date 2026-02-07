/**
 * 중소벤처기업부 API (data.go.kr)
 * 중소벤처24 지원사업 목록
 */

interface MssBizItem {
  intg_pbanc_biz_nm: string; // 통합공고 사업명
  biz_pbanc_nm: string; // 사업공고명
  pbanc_ctnt: string; // 공고 내용
  aply_trgt_ctnt: string; // 지원 대상 내용
  biz_trgt_age: string; // 대상 연령
  aply_trgt: string; // 지원 대상
  biz_enyy: string; // 사업 연도
  pbanc_rcpt_bgng_dt: string; // 접수 시작일
  pbanc_rcpt_end_dt: string; // 접수 종료일
  pbanc_no: string; // 공고 번호
}

interface MssBizResponse {
  response?: {
    body?: {
      items?: MssBizItem[];
      totalCount?: number;
    };
  };
}

export async function fetchMssBizPrograms(pageNo = 1, numOfRows = 100) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY not set");

  const params = new URLSearchParams({
    serviceKey,
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
  });

  const response = await fetch(
    `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?${params}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error(`MSS Biz API error: ${response.status}`);
  }

  const data: MssBizResponse = await response.json();
  const items = data.response?.body?.items ?? [];

  return items.map((item) => ({
    source: "mss" as const,
    source_id: item.pbanc_no || item.biz_pbanc_nm,
    title: item.biz_pbanc_nm || item.intg_pbanc_biz_nm,
    summary: item.pbanc_ctnt,
    target: item.aply_trgt_ctnt || item.aply_trgt,
    hashtags: [] as string[],
    apply_start: item.pbanc_rcpt_bgng_dt || null,
    apply_end: item.pbanc_rcpt_end_dt || null,
    institution: "중소벤처기업부",
    detail_url: null,
    attachment_urls: {},
    raw_data: item,
  }));
}
