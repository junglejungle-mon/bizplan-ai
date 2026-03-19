import { describe, it, expect } from "vitest";
import { sanitizeSvg } from "@/lib/utils/svg-sanitizer";

describe("sanitizeSvg", () => {
  // === 정상 SVG 통과 ===
  it("정상 SVG를 그대로 통과시킨다", () => {
    const svg = '<svg viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="blue"/></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  it("복잡한 SVG 차트를 보존한다", () => {
    const svg = '<svg><g transform="translate(10,10)"><circle cx="50" cy="50" r="40" stroke="black"/><text x="50" y="50">Label</text></g></svg>';
    expect(sanitizeSvg(svg)).toBe(svg);
  });

  // === script 태그 제거 ===
  it("script 태그를 제거한다", () => {
    const input = '<svg><script>alert("xss")</script><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("<script");
    expect(result).not.toContain("alert");
    expect(result).toContain("<rect/>");
  });

  it("셀프 클로징 script 태그를 제거한다", () => {
    const input = '<svg><script src="evil.js"/><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("script");
  });

  // === 이벤트 핸들러 제거 ===
  it("onclick 이벤트 핸들러를 제거한다", () => {
    const input = '<svg><rect onclick="alert(1)" width="100"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("onclick");
    expect(result).toContain("width");
  });

  it("onerror 이벤트 핸들러를 제거한다", () => {
    const input = '<svg><image onerror="alert(1)" href="x.png"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("onerror");
  });

  it("onload 이벤트 핸들러를 제거한다", () => {
    const input = '<svg onload="fetch(\'evil.com\')"><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("onload");
  });

  // === javascript: 프로토콜 제거 ===
  it("javascript: 프로토콜을 제거한다", () => {
    const input = '<svg><a href="javascript:alert(1)"><text>click</text></a></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("javascript:");
  });

  it("data: 프로토콜을 제거한다", () => {
    const input = '<svg><image href="data:text/html,<script>alert(1)</script>"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("data:");
  });

  // === 위험한 태그 제거 ===
  it("iframe 태그를 제거한다", () => {
    const input = '<svg><foreignObject><iframe src="evil.com"/></foreignObject></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("iframe");
    expect(result).not.toContain("foreignObject");
  });

  it("embed, object 태그를 제거한다", () => {
    const input = '<svg><embed src="evil.swf"/><object data="evil.swf"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("embed");
    expect(result).not.toContain("object");
  });

  it("style 태그를 제거한다 (CSS injection 방지)", () => {
    const input = '<svg><style>body{background:url("evil.com")}</style><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("<style");
  });

  // === CDATA 제거 ===
  it("CDATA 섹션을 제거한다", () => {
    const input = '<svg><text><![CDATA[alert("xss")]]></text></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("CDATA");
    expect(result).not.toContain("alert");
  });

  // === 엣지 케이스 ===
  it("빈 문자열을 처리한다", () => {
    expect(sanitizeSvg("")).toBe("");
  });

  it("null/undefined를 빈 문자열로 처리한다", () => {
    expect(sanitizeSvg(null as unknown as string)).toBe("");
    expect(sanitizeSvg(undefined as unknown as string)).toBe("");
  });

  it("XML 처리 지시문을 제거한다", () => {
    const input = '<?xml version="1.0"?><svg><rect/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("<?xml");
    expect(result).toContain("<svg>");
  });

  // === 복합 공격 패턴 ===
  it("중첩된 악성 코드를 처리한다", () => {
    const input = '<svg><script><script>alert(1)</script></script><rect onclick="alert(2)" onload="alert(3)"/></svg>';
    const result = sanitizeSvg(input);
    expect(result).not.toContain("script");
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("onload");
    expect(result).not.toContain("alert");
  });
});
