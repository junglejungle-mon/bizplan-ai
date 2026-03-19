/**
 * Admin Plans API 통합 테스트
 * Proxy 기반 Supabase mock으로 체이닝 문제 해결
 */
import { vi } from "vitest";

// requireAdmin mock: 인증을 항상 통과시킴
vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: vi.fn().mockResolvedValue(null),
}));

// logger mock: 테스트 중 로깅 억제
vi.mock("@/lib/logger", () => ({
  adminLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
  createLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

// Proxy 기반 Supabase mock: 모든 메서드 호출을 체이닝하고 await 시 결과 반환
function createSupabaseMock(tableResults: Record<string, any>) {
  const callLog: Array<{ table: string; method: string; args: any[] }> = [];

  function createTableProxy(table: string): any {
    return new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "then") {
            // await 시 호출됨 — 해당 테이블의 결과 반환
            const result = tableResults[table] || { data: [], count: 0, error: null };
            return (resolve: any) => resolve(result);
          }
          // 모든 메서드 호출을 기록하고 같은 프록시 반환 (체이닝)
          return (...args: any[]) => {
            callLog.push({ table, method: prop, args });
            return createTableProxy(table);
          };
        },
      }
    );
  }

  return {
    from: (table: string) => createTableProxy(table),
    callLog,
  };
}

let currentMock: ReturnType<typeof createSupabaseMock>;

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => currentMock,
}));

import { GET } from "@/app/api/admin/plans/route";

describe("GET /api/admin/plans", () => {
  it("DB 에러 시 500을 반환해야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: { data: null, count: 0, error: { message: "DB connection failed" } },
    });

    const request = new Request("http://localhost:3000/api/admin/plans");
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("빈 데이터도 정상 응답해야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: { data: [], count: 0, error: null },
    });

    const request = new Request("http://localhost:3000/api/admin/plans");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.plans).toEqual([]);
    expect(data.total).toBe(0);
    expect(data.stats).toBeDefined();
    expect(data.stats.total).toBe(0);
    expect(data.stats.completed).toBe(0);
    expect(data.stats.avgQuality).toBe(0);
  });

  it("plans 데이터에 company_name 등이 enrichment 되어야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: {
        data: [
          {
            id: "plan-1",
            title: "테스트 계획서",
            status: "completed",
            created_at: "2024-01-01",
            company_id: "comp-1",
            program_id: "prog-1",
            companies: { id: "comp-1", name: "테스트회사", industry: "AI" },
            programs: { id: "prog-1", title: "AI 지원사업" },
          },
        ],
        count: 1,
        error: null,
      },
      quality_scores: { data: [{ total_score: 85 }] },
      plan_sections: { data: [], count: 8 },
      matchings: { data: [{ match_score: 92 }] },
    });

    const request = new Request("http://localhost:3000/api/admin/plans");
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0].company_name).toBe("테스트회사");
    expect(data.plans[0].company_industry).toBe("AI");
    expect(data.plans[0].program_title).toBe("AI 지원사업");
    expect(data.total).toBe(1);
  });

  it("status 필터 시 eq 호출이 발생해야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: { data: [], count: 0, error: null },
    });

    const request = new Request("http://localhost:3000/api/admin/plans?status=completed");
    await GET(request);

    const eqCalls = currentMock.callLog.filter(
      (c) => c.table === "business_plans" && c.method === "eq" && c.args[0] === "status"
    );
    expect(eqCalls.length).toBeGreaterThan(0);
    expect(eqCalls[0].args[1]).toBe("completed");
  });

  it("search 필터 시 or 호출이 발생해야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: { data: [], count: 0, error: null },
    });

    const request = new Request("http://localhost:3000/api/admin/plans?search=AI");
    await GET(request);

    const orCalls = currentMock.callLog.filter(
      (c) => c.table === "business_plans" && c.method === "or"
    );
    expect(orCalls.length).toBeGreaterThan(0);
  });

  it("stats 구조가 올바라야 한다", async () => {
    currentMock = createSupabaseMock({
      business_plans: { data: [], count: 0, error: null },
    });

    const request = new Request("http://localhost:3000/api/admin/plans");
    const response = await GET(request);
    const data = await response.json();

    expect(data.stats).toHaveProperty("total");
    expect(data.stats).toHaveProperty("completed");
    expect(data.stats).toHaveProperty("avgQuality");
    expect(data.stats).toHaveProperty("high");
    expect(data.stats).toHaveProperty("medium");
    expect(data.stats).toHaveProperty("low");
  });
});
