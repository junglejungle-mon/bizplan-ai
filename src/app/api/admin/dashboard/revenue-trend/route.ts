import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;
    const supabase = createAdminClient();

    // 최근 6개월 매출 데이터
    const months: Array<{ month: string; revenue: number; subscriptions: number }> = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);

      const monthLabel = `${start.getMonth() + 1}월`;

      try {
        // 해당 월 매출
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("status", "paid")
          .gte("paid_at", start.toISOString())
          .lte("paid_at", end.toISOString());

        const revenue = payments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

        // 해당 월 구독 수
        const { count } = await supabase
          .from("subscriptions")
          .select("id", { count: "exact", head: true })
          .in("status", ["active", "trialing"])
          .lte("created_at", end.toISOString());

        months.push({
          month: monthLabel,
          revenue,
          subscriptions: count || 0,
        });
      } catch {
        months.push({ month: monthLabel, revenue: 0, subscriptions: 0 });
      }
    }

    return Response.json({ data: months });
  } catch (error) {
    console.error("Revenue trend error:", error);
    return Response.json({ data: [] });
  }
}
