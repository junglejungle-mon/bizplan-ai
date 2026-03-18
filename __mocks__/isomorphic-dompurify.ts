/**
 * Jest mock for isomorphic-dompurify
 * Provides basic sanitization for testing (real DOMPurify used at runtime)
 */
const sanitize = (dirty: string, options?: { FORBID_TAGS?: string[]; FORBID_ATTR?: string[] }): string => {
  if (!dirty || typeof dirty !== "string") return "";

  let result = dirty;

  // Remove forbidden tags (with content)
  const defaultForbid = ["script", "foreignObject", "iframe", "object", "embed", "style", "image"];
  const forbidTags = options?.FORBID_TAGS || defaultForbid;
  for (const tag of forbidTags) {
    const openClose = new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}\\s*>`, "gi");
    let prev = "";
    while (prev !== result) {
      prev = result;
      result = result.replace(openClose, "");
    }
    result = result.replace(new RegExp(`<\\/?${tag}[^>]*\\/?>`, "gi"), "");
  }

  // Remove event handler attributes
  const defaultForbidAttr = ["onclick", "onerror", "onload", "xlink:href", "formaction"];
  const forbidAttrs = options?.FORBID_ATTR || defaultForbidAttr;
  for (const attr of forbidAttrs) {
    result = result.replace(new RegExp(`\\s+${attr}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]*)`, "gi"), "");
  }

  // Remove on* event handlers generically
  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");

  // Remove javascript:/data:/vbscript: protocols
  result = result.replace(/(href|xlink:href|src)\s*=\s*["']?\s*(javascript|data|vbscript)\s*:[^"'>\s]*/gi, "");

  // Remove CDATA
  result = result.replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, "");

  // Remove XML processing instructions
  result = result.replace(/<\?[\s\S]*?\?>/g, "");

  return result;
};

const DOMPurify = {
  sanitize,
  isSupported: true,
};

export default DOMPurify;
