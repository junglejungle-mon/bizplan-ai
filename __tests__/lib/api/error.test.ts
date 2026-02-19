import { safeErrorMessage } from "@/lib/api/error";

describe("safeErrorMessage", () => {
  describe("안전한 한국어 메시지 통과", () => {
    it.each([
      "이미 존재하는 이메일입니다",
      "필수 항목을 입력해주세요",
      "잘못된 요청입니다",
      "존재하지 않는 리소스입니다",
      "권한이 없습니다",
      "인증이 필요합니다",
      "유효하지 않은 토큰",
      "사용할 수 없는 기능입니다",
      "찾을 수 없는 페이지",
      "시간이 초과되었습니다",
      "요청이 너무 많습니다",
      "지원하지 않는 형식",
    ])("'%s'는 그대로 반환", (msg) => {
      const error = new Error(msg);
      expect(safeErrorMessage(error)).toBe(msg);
    });
  });

  describe("DB/인프라 에러 차단", () => {
    it.each([
      "relation \"users\" does not exist",
      "column \"email\" does not exist",
      "violates unique constraint",
      "duplicate key value violates unique constraint",
      "null value in column \"name\"",
      "syntax error at or near SELECT",
      "permission denied for table users",
      "connect ECONNREFUSED 127.0.0.1:5432",
      "jwt expired",
      "token invalid",
      "api_key is required",
      "supabase error: timeout",
      "Error at /app/src/lib/utils.ts:42",
      "node_modules/next/dist/server.js",
    ])("'%s'는 차단되어 fallback 반환", (msg) => {
      const error = new Error(msg);
      expect(safeErrorMessage(error)).toBe("요청 처리 중 오류가 발생했습니다");
    });
  });

  describe("non-Error 입력", () => {
    it("문자열은 fallback 반환", () => {
      expect(safeErrorMessage("string error")).toBe("요청 처리 중 오류가 발생했습니다");
    });

    it("null은 fallback 반환", () => {
      expect(safeErrorMessage(null)).toBe("요청 처리 중 오류가 발생했습니다");
    });

    it("숫자는 fallback 반환", () => {
      expect(safeErrorMessage(42)).toBe("요청 처리 중 오류가 발생했습니다");
    });
  });

  describe("커스텀 fallback", () => {
    it("커스텀 fallback 메시지 사용", () => {
      expect(safeErrorMessage("error", "저장 실패")).toBe("저장 실패");
    });
  });

  describe("짧은 한국어 메시지 통과", () => {
    it("100자 이내 한국어 메시지는 통과", () => {
      const msg = "데이터를 불러오는 중 문제가 발생했어요";
      expect(safeErrorMessage(new Error(msg))).toBe(msg);
    });

    it("한국어 없는 영문 메시지는 차단", () => {
      const msg = "Something went wrong during processing";
      expect(safeErrorMessage(new Error(msg))).toBe("요청 처리 중 오류가 발생했습니다");
    });
  });
});
