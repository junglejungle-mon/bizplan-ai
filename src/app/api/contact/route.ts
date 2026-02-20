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

    const { error: dbError } = await supabase.from("contact_inquiries").insert({
      name,
      email,
      category,
      message,
      status: "pending",
    });

    if (dbError) {
      console.error("[contact] DB 저장 실패:", dbError);
      return Response.json(
        { success: false, error: "문의 접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error("[contact] 문의 접수 오류:", error);
    return Response.json(
      { success: false, error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
