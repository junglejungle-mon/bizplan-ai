import { openApiSpec } from "@/lib/openapi";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * GET /api/admin/openapi
 * OpenAPI 3.0 JSON 스펙 반환
 */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  return Response.json(openApiSpec, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
