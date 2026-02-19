/**
 * Rate Limiter 단위 테스트
 */
import { rateLimit, getClientIP, RATE_LIMITS } from "@/lib/utils/rate-limit";

describe("rateLimit", () => {
  // 테스트마다 새 키 사용 (인메모리 store 공유 방지)
  const uniqueKey = () => `test-${Date.now()}-${Math.random()}`;

  it("첫 요청은 항상 성공해야 한다", () => {
    const result = rateLimit(uniqueKey(), { limit: 5, window: 60000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("제한 내 요청은 모두 성공해야 한다", () => {
    const key = uniqueKey();
    const config = { limit: 3, window: 60000 };

    const r1 = rateLimit(key, config);
    const r2 = rateLimit(key, config);
    const r3 = rateLimit(key, config);

    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.success).toBe(true);
    expect(r2.remaining).toBe(1);
    expect(r3.success).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("제한 초과 요청은 실패해야 한다", () => {
    const key = uniqueKey();
    const config = { limit: 2, window: 60000 };

    rateLimit(key, config);
    rateLimit(key, config);
    const r3 = rateLimit(key, config);

    expect(r3.success).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("서로 다른 키는 독립적으로 동작해야 한다", () => {
    const key1 = uniqueKey();
    const key2 = uniqueKey();
    const config = { limit: 1, window: 60000 };

    const r1 = rateLimit(key1, config);
    const r2 = rateLimit(key2, config);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
  });

  it("remaining 값이 정확히 감소해야 한다", () => {
    const key = uniqueKey();
    const config = { limit: 5, window: 60000 };

    for (let i = 0; i < 5; i++) {
      const r = rateLimit(key, config);
      expect(r.remaining).toBe(4 - i);
    }
  });

  it("resetAt은 미래 시간이어야 한다", () => {
    const result = rateLimit(uniqueKey(), { limit: 5, window: 60000 });
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });
});

describe("RATE_LIMITS 프리셋", () => {
  it("AI_GENERATE는 분당 5회여야 한다", () => {
    expect(RATE_LIMITS.AI_GENERATE.limit).toBe(5);
    expect(RATE_LIMITS.AI_GENERATE.window).toBe(60000);
  });

  it("AUTH는 분당 10회여야 한다", () => {
    expect(RATE_LIMITS.AUTH.limit).toBe(10);
    expect(RATE_LIMITS.AUTH.window).toBe(60000);
  });

  it("CONTACT는 시간당 5회여야 한다", () => {
    expect(RATE_LIMITS.CONTACT.limit).toBe(5);
    expect(RATE_LIMITS.CONTACT.window).toBe(3600000);
  });
});

describe("getClientIP", () => {
  it("x-forwarded-for 헤더에서 IP를 추출해야 한다", () => {
    const req = new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
    });
    expect(getClientIP(req)).toBe("1.2.3.4");
  });

  it("x-real-ip 헤더에서 IP를 추출해야 한다", () => {
    const req = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(getClientIP(req)).toBe("10.0.0.1");
  });

  it("헤더 없으면 unknown을 반환해야 한다", () => {
    const req = new Request("http://localhost");
    expect(getClientIP(req)).toBe("unknown");
  });

  it("x-forwarded-for가 x-real-ip보다 우선해야 한다", () => {
    const req = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
      },
    });
    expect(getClientIP(req)).toBe("1.1.1.1");
  });
});
