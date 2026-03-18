/**
 * SVG Sanitizer — dangerouslySetInnerHTML XSS 방지
 *
 * AI가 생성한 SVG 차트를 렌더링하기 전에 위험한 태그/속성 제거
 * DOMPurify 기반 안전한 구현
 */
import DOMPurify from "isomorphic-dompurify";

/**
 * SVG 문자열에서 위험한 요소 제거
 *
 * - script, iframe, object, embed, foreignObject 태그 완전 제거
 * - 이벤트 핸들러 속성 (onclick, onerror 등) 제거
 * - javascript: 프로토콜 제거
 */
export function sanitizeSvg(svgString: string): string {
  if (!svgString || typeof svgString !== "string") return "";

  return DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    ADD_TAGS: ["text", "tspan", "textPath"],
    FORBID_TAGS: ["script", "foreignObject", "iframe", "object", "embed", "style", "image"],
    FORBID_ATTR: ["onclick", "onerror", "onload", "xlink:href", "formaction"],
  });
}
