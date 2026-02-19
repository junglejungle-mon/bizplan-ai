import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const supabase = createAdminClient();

    // 최근 6개월 사용자 증가 데이터
    const months: Array<{ month: string; newUsers: number; totalUsers: number }> = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthLabel = `${start.getMonth() + 1}월`;

      try {
        // 해당 월 신규 가입
        const { count: newUsers } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gte("created_at", start.toISOString())
          .lte("created_at", end.toISOString());

        // 해당 월까지 누적 사용자
        const { count: totalUsers } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .lte("created_at", end.toISOString());

        months.push({
          month: monthLabel,
          newUsers: newUsers || 0,
          totalUsers: totalUsers || 0,
        });
      } catch {
        months.push({ month: monthLabel, newUsers: 0, totalUsers: 0 });
      }
    }

    return Response.json({ data: months });
  } catch (error) {
    console.error("User growth error:", error);
    return Response.json({ data: [] });
  }
}
