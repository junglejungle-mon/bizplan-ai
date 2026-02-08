/**
 * 중소벤처기업부 API (data.go.kr)
 * XML 응답 → 파싱하여 사용
 */

export async function fetchMssBizPrograms(pageNo = 1, numOfRows = 100) {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) throw new Error("DATA_GO_KR_SERVICE_KEY not set");

  // data.go.kr 서비스키는 URLSearchParams가 이중 인코딩하므로 직접 URL에 삽입
  const encodedKey = encodeURIComponent(serviceKey);
  const params = new URLSearchParams({
    pageNo: String(pageNo),
    numOfRows: String(numOfRows),
  });

  const response = await fetch(
    `https://apis.data.go.kr/1421000/mssBizService_v2/getbizList_v2?serviceKey=${encodedKey}&${params}`,
    {
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
        "Accept": "application/xml",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`MSS Biz API error: ${response.status}`);
  }

  const xmlText = await response.text();

  // XML에서 item 추출 (간단한 정규식 파싱)
  const items: Array<{
    itemId: string;
    title: string;
    dataContents: string;
    applicationStartDate: string;
    applicationEndDate: string;
    writerName: string;
    writerPosition: string;
    writerPhone: string;
    viewUrl: string;
    fileName: string;
    fileUrl: string;
  }> = [];

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      // CDATA 패턴
      const cdataRegex = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`);
      const cdataMatch = itemXml.match(cdataRegex);
      if (cdataMatch) return cdataMatch[1].trim();

      // 일반 텍스트 패턴
      const textRegex = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
      const textMatch = itemXml.match(textRegex);
      if (textMatch) return textMatch[1].trim();

      return "";
    };

    const title = getTag("title");
    if (!title) continue; // title 없는 건 건너뜀

    items.push({
      itemId: getTag("itemId"),
      title,
      dataContents: getTag("dataContents"),
      applicationStartDate: getTag("applicationStartDate"),
      applicationEndDate: getTag("applicationEndDate"),
      writerName: getTag("writerName"),
      writerPosition: getTag("writerPosition"),
      writerPhone: getTag("writerPhone"),
      viewUrl: getTag("viewUrl"),
      fileName: getTag("fileName"),
      fileUrl: getTag("fileUrl"),
    });
  }

  return items.map((item) => {
    // HTML 태그 제거
    const cleanHtml = (html: string) =>
      html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

    // 날짜 포맷 변환 (YYYY-MM-DD)
    const formatDate = (d: string) => {
      if (!d) return null;
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      const m = d.match(/(\d{4})[\.\-]?(\d{2})[\.\-]?(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
    };

    return {
      source: "mss" as const,
      source_id: item.itemId || item.title,
      title: item.title,
      summary: cleanHtml(item.dataContents).slice(0, 500),
      target: null as string | null,
      hashtags: [] as string[],
      apply_start: formatDate(item.applicationStartDate),
      apply_end: formatDate(item.applicationEndDate),
      institution: "중소벤처기업부",
      detail_url: item.viewUrl || null,
      attachment_urls: item.fileUrl
        ? { file: item.fileUrl, fileName: item.fileName }
        : {},
      raw_data: item as unknown as Record<string, any>,
    };
  });
}
