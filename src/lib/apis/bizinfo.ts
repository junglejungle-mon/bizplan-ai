/**
 * 기업마당 API (bizinfo.go.kr)
 * 중앙부처 + 지자체 + 유관기관 통합 지원사업 공고
 */

interface BizinfoItem {
  pblancNm: string; // 공고명
  bsnsSumryCn: string; // 사업 요약
  trgetNm: string; // 지원 대상
  hashtags: string; // 해시태그
  reqstBeginEndDe: string; // 신청기간
  jrsdInsttNm: string; // 관할 기관
  excInsttNm: string; // 수행 기관
  printFlpthNm: string; // 공고문 PDF URL
  flpthNm: string; // 첨부파일 URL
  rceptEngnHmpgUrl: string; // 접수 홈페이지
  pblancId: string; // 공고 ID
}

interface BizinfoResponse {
  jsonArray?: BizinfoItem[];
}

export async function fetchBizinfoPrograms(pageIndex = 1, pageUnit = 100) {
  const crtfcKey = process.env.BIZINFO_CRTFC_KEY;
  if (!crtfcKey) throw new Error("BIZINFO_CRTFC_KEY not set");

  const params = new URLSearchParams({
    crtfcKey,
    dataType: "json",
    searchCnt: "0",
    pageUnit: String(pageUnit),
    pageIndex: String(pageIndex),
  });

  const response = await fetch(
    `https://www.bizinfo.go.kr/uss/rss/bizinfoApi.do?${params}`,
    { cache: "no-store" }
  );

  if (!response.ok) {
    throw new Error(`Bizinfo API error: ${response.status}`);
  }

  const data: BizinfoResponse = await response.json();
  const items = data.jsonArray ?? [];

  return items.map((item) => ({
    source: "bizinfo" as const,
    source_id: item.pblancId || item.pblancNm,
    title: item.pblancNm,
    summary: item.bsnsSumryCn,
    target: item.trgetNm,
    hashtags: item.hashtags
      ? item.hashtags
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean)
      : [],
    apply_period: item.reqstBeginEndDe,
    institution: item.jrsdInsttNm || item.excInsttNm,
    detail_url: item.rceptEngnHmpgUrl,
    attachment_urls: {
      pdf: item.printFlpthNm,
      file: item.flpthNm,
    },
    raw_data: item,
  }));
}
