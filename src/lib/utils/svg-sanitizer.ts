/**
 * SVG Sanitizer — dangerouslySetInnerHTML XSS 방지
 *
 * AI가 생성한 SVG 차트를 렌더링하기 전에 위험한 태그/속성 제거
 * DOMPurify 없이 가벼운 서버 호환 구현
 */

/* eslint-disable @typescript-eslint/no-unused-vars -- security reference constants */
/** 허용되는 SVG 태그 */
const _ALLOWED_TAGS = new Set([
  "svg",
  "g",
  "rect",
  "circle",
  "ellipse",
  "line",
  "polyline",
  "polygon",
  "path",
  "text",
  "tspan",
  "textPath",
  "defs",
  "linearGradient",
  "radialGradient",
  "stop",
  "clipPath",
  "mask",
  "pattern",
  "use",
  "symbol",
  "title",
  "desc",
  "marker",
  "image",
]);

/** 금지되는 속성 (이벤트 핸들러 + 위험 속성) */
const _BLOCKED_ATTR_PATTERNS = [
  /^on/i, // onclick, onerror, onload 등
  /^xlink:href$/i, // 외부 리소스 참조 (use 태그 제외)
  /^href$/i,
  /^formaction$/i,
  /^action$/i,
  /^data$/i,
];

/** 위험한 프로토콜 */
const _DANGEROUS_PROTOCOLS = /^\s*(javascript|data|vbscript)\s*:/i;
/* eslint-enable @typescript-eslint/no-unused-vars */

/**
 * SVG 문자열에서 위험한 요소 제거
 *
 * - script, iframe, object, embed, foreignObject 태그 완전 제거
 * - 이벤트 핸들러 속성 (onclick, onerror 등) 제거
 * - javascript: 프로토콜 제거
 */
export function sanitizeSvg(svgString: string): string {
  if (!svgString || typeof svgString !== "string") return "";

  let sanitized = svgString;

  // 1. 위험한 태그 완전 제거 (내용 포함)
  const dangerousTags = [
    "script",
    "iframe",
    "object",
    "embed",
    "foreignObject",
    "applet",
    "base",
    "form",
    "input",
    "button",
    "select",
    "textarea",
    "link",
    "meta",
    "style",
  ];

  for (const tag of dangerousTags) {
    // 여는/닫는 태그 반복 제거 (중첩 대응)
    const openClose = new RegExp(
      `<${tag}[\\s\\S]*?<\\/${tag}\\s*>`,
      "gi"
    );
    let prev = "";
    while (prev !== sanitized) {
      prev = sanitized;
      sanitized = sanitized.replace(openClose, "");
    }
    // 셀프 클로징 + 남은 여는/닫는 태그 개별 제거
    sanitized = sanitized.replace(new RegExp(`<\\/?${tag}[^>]*\\/?>`, "gi"), "");
  }

  // 2. 이벤트 핸들러 속성 제거 (on* 속성)
  sanitized = sanitized.replace(
    /\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi,
    ""
  );

  // 3. javascript: / data: 프로토콜 제거
  sanitized = sanitized.replace(
    /(href|xlink:href|src)\s*=\s*["']?\s*(javascript|data|vbscript)\s*:[^"'>\s]*/gi,
    ""
  );

  // 4. CDATA 내 스크립트 실행 방지
  sanitized = sanitized.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");

  // 5. XML 처리 지시문 제거
  sanitized = sanitized.replace(/<\?[\s\S]*?\?>/g, "");

  // 6. HTML 주석 내 조건부 실행 제거 (IE conditional comments)
  sanitized = sanitized.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, "");

  return sanitized;
}
