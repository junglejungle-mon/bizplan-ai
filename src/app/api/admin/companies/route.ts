import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const offset = (page - 1) * limit;

    // 업체 목록 + 관련 데이터 카운트
    let query = supabase
      .from("companies")
      .select(
        `
        id, name, business_content, industry, region,
        employee_count, revenue, established_date,
        profile_score, is_active, created_at, updated_at,
        user_id,
        profiles!inner(id, email, name)
      `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `name.ilike.%${search}%,industry.ilike.%${search}%,business_content.ilike.%${search}%`
      );
    }

    const { data: companies, count, error } = await query;
    if (error) throw error;

    // 각 업체별 인터뷰/매칭/계획서 카운트
    const enriched = await Promise.all(
      (companies || []).map(async (company) => {
        const [interviews, matchings, plans] = await Promise.all([
          supabase
            .from("company_interviews")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id),
          supabase
            .from("matchings")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id),
          supabase
            .from("business_plans")
            .select("id", { count: "exact", head: true })
            .eq("company_id", company.id),
        ]);

        return {
          ...company,
          interview_count: interviews.count || 0,
          matching_count: matchings.count || 0,
          plan_count: plans.count || 0,
        };
      })
    );

    return NextResponse.json({ companies: enriched, total: count || 0 });
  } catch (err) {
    console.error("업체 목록 조회 실패:", err);
    return NextResponse.json(
      { error: "업체 목록을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}
