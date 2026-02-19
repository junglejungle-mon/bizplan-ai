import {
  calculateProfileScore,
  getProfileScoreBreakdown,
} from "@/lib/utils/profile-score";

describe("calculateProfileScore", () => {
  describe("기본 정보 점수 (30점 만점)", () => {
    it("모든 기본 필드가 있으면 30점", () => {
      const company = {
        name: "정글몬스터",
        industry: "반려동물",
        region: "서울",
        employee_count: 10,
        revenue: "5억원",
        established_date: "2020-01-01",
      };
      const breakdown = getProfileScoreBreakdown(company, 0);
      expect(breakdown.basic).toBe(30);
    });

    it("빈 회사 데이터는 기본 정보 0점", () => {
      const breakdown = getProfileScoreBreakdown({}, 0);
      expect(breakdown.basic).toBe(0);
    });

    it("일부 필드만 있으면 해당 점수만 합산", () => {
      const company = { name: "테스트", industry: "IT" };
      const breakdown = getProfileScoreBreakdown(company, 0);
      expect(breakdown.basic).toBe(10); // 5 + 5
    });

    it("null/빈문자열 필드는 점수 없음", () => {
      const company = {
        name: null,
        industry: "",
        region: "   ",
        employee_count: 0,
      };
      const breakdown = getProfileScoreBreakdown(company, 0);
      expect(breakdown.basic).toBe(0);
    });
  });

  describe("사업 내용 점수 (30점 만점)", () => {
    it("500자 이상이면 30점", () => {
      const company = { business_content: "a".repeat(500) };
      const breakdown = getProfileScoreBreakdown(company, 0);
      expect(breakdown.content).toBe(30);
    });

    it("300~499자면 25점", () => {
      const company = { business_content: "a".repeat(300) };
      expect(getProfileScoreBreakdown(company, 0).content).toBe(25);
    });

    it("150~299자면 20점", () => {
      const company = { business_content: "a".repeat(150) };
      expect(getProfileScoreBreakdown(company, 0).content).toBe(20);
    });

    it("80~149자면 15점", () => {
      const company = { business_content: "a".repeat(80) };
      expect(getProfileScoreBreakdown(company, 0).content).toBe(15);
    });

    it("30~79자면 10점", () => {
      const company = { business_content: "a".repeat(30) };
      expect(getProfileScoreBreakdown(company, 0).content).toBe(10);
    });

    it("1~29자면 5점", () => {
      const company = { business_content: "짧은 내용" };
      expect(getProfileScoreBreakdown(company, 0).content).toBe(5);
    });

    it("빈 문자열/null이면 0점", () => {
      expect(getProfileScoreBreakdown({ business_content: "" }, 0).content).toBe(0);
      expect(getProfileScoreBreakdown({ business_content: null }, 0).content).toBe(0);
      expect(getProfileScoreBreakdown({}, 0).content).toBe(0);
    });
  });

  describe("인터뷰 점수 (40점 만점)", () => {
    it("15개 답변이면 40점", () => {
      expect(getProfileScoreBreakdown({}, 15).interview).toBe(40);
    });

    it("0개 답변이면 0점", () => {
      expect(getProfileScoreBreakdown({}, 0).interview).toBe(0);
    });

    it("7~8개 답변이면 약 20점 내외", () => {
      const score = getProfileScoreBreakdown({}, 7).interview;
      expect(score).toBeGreaterThanOrEqual(17);
      expect(score).toBeLessThanOrEqual(21);
    });

    it("15개 초과해도 40점을 넘지 않음", () => {
      expect(getProfileScoreBreakdown({}, 30).interview).toBe(40);
    });
  });

  describe("종합 점수", () => {
    it("완벽한 프로필은 100점", () => {
      const company = {
        name: "정글몬스터",
        industry: "반려동물",
        region: "서울",
        employee_count: 10,
        revenue: "5억원",
        established_date: "2020-01-01",
        business_content: "a".repeat(500),
      };
      expect(calculateProfileScore(company, 15)).toBe(100);
    });

    it("빈 프로필은 0점", () => {
      expect(calculateProfileScore({}, 0)).toBe(0);
    });

    it("100점을 초과하지 않음", () => {
      const company = {
        name: "정글몬스터",
        industry: "반려동물",
        region: "서울",
        employee_count: 100,
        revenue: "100억원",
        established_date: "2015-01-01",
        business_content: "a".repeat(1000),
      };
      expect(calculateProfileScore(company, 50)).toBeLessThanOrEqual(100);
    });

    it("0 미만이 되지 않음", () => {
      expect(calculateProfileScore({}, -5)).toBeGreaterThanOrEqual(0);
    });
  });
});
