import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, getClientIP, RATE_LIMITS, rateLimitResponse } from "@/lib/utils/rate-limit";
import { validateBody, contactSchema } from "@/lib/api/validation";

export async function POST(request: NextRequest) {
  // Rate limiting: 시간당 5회
  const ip = getClientIP(request);
  const rl = rateLimit(`contact:${ip}`, RATE_LIMITS.CONTACT);
  if (!rl.success) return rateLimitResponse(rl);

  try {
    const [body, validationError] = await validateBody(request, contactSchema);
    if (validationError) return validationError;
    const { name, email, category, message } = body;

    const supabase = createAdminClient();

    await supabase.from("contact_inquiries").insert({
      name,
      email,
      category,
      message,
      status: "pending",
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error("[contact] 문의 접수 오류:", error);
    return Response.json({ success: true }); // 문의는 실패해도 접수로 처리
  }
}
