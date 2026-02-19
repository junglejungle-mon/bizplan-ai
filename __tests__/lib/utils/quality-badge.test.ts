/**
 * QualityBadge 컴포넌트 로직 테스트 (순수 로직만)
 */

// 품질 등급 판별 함수 (컴포넌트에서 추출한 로직)
function getQualityLevel(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  if (score >= 80) return { level: "high", label: "우수" };
  if (score >= 60) return { level: "medium", label: "보통" };
  return { level: "low", label: "개선필요" };
}

describe("품질 등급 판별", () => {
  it("80점 이상은 우수여야 한다", () => {
    expect(getQualityLevel(80)).toEqual({ level: "high", label: "우수" });
    expect(getQualityLevel(95)).toEqual({ level: "high", label: "우수" });
    expect(getQualityLevel(100)).toEqual({ level: "high", label: "우수" });
  });

  it("60~79점은 보통이어야 한다", () => {
    expect(getQualityLevel(60)).toEqual({ level: "medium", label: "보통" });
    expect(getQualityLevel(70)).toEqual({ level: "medium", label: "보통" });
    expect(getQualityLevel(79)).toEqual({ level: "medium", label: "보통" });
  });

  it("60점 미만은 개선필요여야 한다", () => {
    expect(getQualityLevel(59)).toEqual({ level: "low", label: "개선필요" });
    expect(getQualityLevel(30)).toEqual({ level: "low", label: "개선필요" });
    expect(getQualityLevel(0)).toEqual({ level: "low", label: "개선필요" });
  });

  it("null/undefined는 null을 반환해야 한다", () => {
    expect(getQualityLevel(null)).toBeNull();
    expect(getQualityLevel(undefined)).toBeNull();
  });

  it("경계값이 정확해야 한다 (59→개선, 60→보통, 79→보통, 80→우수)", () => {
    expect(getQualityLevel(59)?.level).toBe("low");
    expect(getQualityLevel(60)?.level).toBe("medium");
    expect(getQualityLevel(79)?.level).toBe("medium");
    expect(getQualityLevel(80)?.level).toBe("high");
  });
});
