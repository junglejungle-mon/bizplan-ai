/**
 * 소상공인24 (sbiz24.kr) 크롤러
 * 내부 API 2개 활용:
 *   1. POST /api/exltdPbanc — 외부 연계 지원사업 공고
 *   2. POST /api/loanProduct — 소상공인 융자상품
 * 인증 불필요 (공개 내부 API, Origin-Method: GET 헤더 필요)
 * 주의: sbiz24.kr은 한국 정부 인증서 체인 이슈로 TLS 검증 실패 가능
 */
/**
 * sbiz24.kr 전용 TLS Agent (정부 사이트 인증서 체인 이슈 대응)
 * Next.js/Vercel 런타임에서는 정상 동작하나, 로컬 환경에서 인증서 체인 문제 발생 가능
 * 런타임에 undici를 동적 로딩하여 TLS 우회 Agent 생성
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let tlsAgent: any = undefined;
try {
  // Node.js 내장 undici (Next.js 런타임에서 사용 가능)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Agent } = require("undici");
  tlsAgent = new Agent({ connect: { rejectUnauthorized: false } });
} catch {
  // undici 없으면 기본 fetch 사용 (Vercel 환경에서는 TLS 이슈 없음)
}

// ===== 외부 연계 공고 (exltdPbanc) =====

interface ExltdPbancItem {
  pbancId: string; // 공고 ID (e.g. "PBLN_000000000117920")
  linkPbancNm: string; // 공고명
  jrsdInstNm: string | null; // 소관부처/지역
  linkFlfmtInstNm: string | null; // 수행기관
  sprtFldLclsfNm: string | null; // 지원분야 대분류 (금융, 기술 등)
  sprtFldMclsfNm: string | null; // 지원분야 중분류 (보증, 융자 등)
  sprtTrgtNm: string | null; // 지원대상
  bizOutlCn: string | null; // 사업개요 (HTML)
  bizAplyMthdExpln: string | null; // 신청방법
  enqrNm: string | null; // 문의처
  hstgNm: string | null; // 해시태그 (콤마 구분)
  aplyPdEndKornNm: string | null; // 접수마감일 (e.g. "2026-03-31")
  pbancUrlAddr: string | null; // 원본 URL (bizinfo.go.kr 등)
  regDt: string | null; // 등록일
  linkInqCnt: number | null; // 조회수
}

/** 공통 API 응답 래퍼: { result, data: { default: { list, total, page } } } */
interface Sbiz24ApiResponse<T> {
  result: boolean;
  message: string | null;
  data: {
    default: {
      list: T[];
      total: number;
      page: {
        totalElements: number;
        totalPages: number;
        numberOfElements: number;
      };
    };
  };
}

// ===== 융자상품 (loanProduct) =====

interface LoanProductItem {
  loanGdsSn: string; // 상품 일련번호
  fncGdsNm: string; // 상품명
  trmtInstNm: string | null; // 취급기관
  pvsnInstNm: string | null; // 제공기관
  irVl: string | null; // 금리
  irTypeVl: string | null; // 금리유형
  loanLimitVl: string | null; // 대출한도
  trgtCn: string | null; // 대상
  useUsgVl: string | null; // 용도
  joinMthdCn: string | null; // 가입방법
  rpmtMthdCn: string | null; // 상환방법
  srvcPvsnRgnVl: string | null; // 서비스 제공지역
  sprtTrgtDtlCndCn: string | null; // 상세 자격조건
  rltnSiteAddr: string | null; // 관련 사이트
}

// LoanProductResponse는 Sbiz24ApiResponse<LoanProductItem> 사용

const SBIZ24_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "Origin-Method": "GET",
  Origin: "https://www.sbiz24.kr",
  Referer: "https://www.sbiz24.kr/",
  "User-Agent": "Mozilla/5.0 (compatible; BizPlanAI/1.0)",
};

type Sbiz24ResultItem = ReturnType<typeof mapExltdPbanc> | ReturnType<typeof mapLoanProduct>;

/**
 * 전체 소상공인24 수집 (외부 공고 + 융자상품)
 */
export async function fetchAllSbiz24Programs(maxPages = 20) {
  const allItems: Sbiz24ResultItem[] = [];
  const PAGE_SIZE = 50;

  // 1. 외부 연계 공고 수집
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchExltdPbanc(page, PAGE_SIZE);
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
  }

  // 2. 융자상품 수집
  for (let page = 1; page <= maxPages; page++) {
    const items = await fetchLoanProducts(page, PAGE_SIZE);
    allItems.push(...items);
    if (items.length < PAGE_SIZE) break;
  }

  return allItems;
}

// ===== 외부 공고 맵핑 =====

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function mapExltdPbanc(item: ExltdPbancItem) {
  // 해시태그 파싱
  const hashtags: string[] = ["소상공인"];
  if (item.hstgNm) {
    const tags = item.hstgNm.split(",").map((t) => t.trim()).filter(Boolean);
    hashtags.push(...tags.slice(0, 10));
  }
  if (item.sprtFldLclsfNm) hashtags.push(item.sprtFldLclsfNm);

  return {
    source: "sbiz24" as const,
    source_id: item.pbancId,
    title: item.linkPbancNm,
    summary: stripHtml(item.bizOutlCn)?.slice(0, 500) || null,
    target: item.sprtTrgtNm || "소상공인",
    hashtags,
    apply_start: null as string | null,
    apply_end: item.aplyPdEndKornNm || null,
    institution: item.linkFlfmtInstNm || item.jrsdInstNm || "소상공인시장진흥공단",
    detail_url: item.pbancUrlAddr || `https://www.sbiz24.kr/extldPbanc/${item.pbancId}`,
    attachment_urls: {},
    raw_data: item as unknown as Record<string, unknown>,
  };
}

// ===== 융자상품 맵핑 =====

function mapLoanProduct(item: LoanProductItem) {
  const hashtags: string[] = ["소상공인", "융자"];
  if (item.pvsnInstNm) hashtags.push(item.pvsnInstNm);

  // 대상 + 상세조건 합치기
  const targetParts: string[] = [];
  if (item.trgtCn) targetParts.push(item.trgtCn);
  if (item.sprtTrgtDtlCndCn) targetParts.push(item.sprtTrgtDtlCndCn);
  const target = targetParts.join(" / ").slice(0, 500) || "소상공인";

  // 요약: 금리 + 한도 + 용도
  const summaryParts: string[] = [];
  if (item.irVl) summaryParts.push(`금리: ${item.irVl}`);
  if (item.loanLimitVl) summaryParts.push(`한도: ${item.loanLimitVl}`);
  if (item.useUsgVl) summaryParts.push(`용도: ${item.useUsgVl}`);
  const summary = summaryParts.join(" | ").slice(0, 500) || null;

  return {
    source: "sbiz24" as const,
    source_id: `loan-${item.loanGdsSn}`,
    title: item.fncGdsNm,
    summary,
    target,
    hashtags,
    apply_start: null as string | null,
    apply_end: null as string | null,
    institution: item.pvsnInstNm || item.trmtInstNm || "소상공인시장진흥공단",
    detail_url: item.rltnSiteAddr || null,
    attachment_urls: {},
    raw_data: item as unknown as Record<string, unknown>,
  };
}

// ===== API 호출 =====

async function fetchExltdPbanc(page = 1, pageSize = 50) {
  const response = await fetch("https://www.sbiz24.kr/api/exltdPbanc", {
    method: "POST",
    headers: SBIZ24_HEADERS,
    body: JSON.stringify({
      search: { pageIndex: page, pageSize },
    }),
    cache: "no-store" as RequestCache,
    ...(tlsAgent ? { dispatcher: tlsAgent } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `sbiz24 exltdPbanc API error: ${response.status} — ${errorBody.substring(0, 200)}`
    );
  }

  const data: Sbiz24ApiResponse<ExltdPbancItem> = await response.json();
  const items = data.data?.default?.list ?? [];

  return items
    .filter((item) => item.linkPbancNm)
    .map(mapExltdPbanc);
}

async function fetchLoanProducts(page = 1, pageSize = 50) {
  const response = await fetch("https://www.sbiz24.kr/api/loanProduct", {
    method: "POST",
    headers: SBIZ24_HEADERS,
    body: JSON.stringify({
      search: { pageIndex: page, pageSize },
    }),
    cache: "no-store" as RequestCache,
    ...(tlsAgent ? { dispatcher: tlsAgent } : {}),
  } as RequestInit);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `sbiz24 loanProduct API error: ${response.status} — ${errorBody.substring(0, 200)}`
    );
  }

  const data: Sbiz24ApiResponse<LoanProductItem> = await response.json();
  const items = data.data?.default?.list ?? [];

  return items
    .filter((item) => item.fncGdsNm)
    .map(mapLoanProduct);
}
