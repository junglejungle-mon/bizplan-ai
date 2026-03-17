import { NextRequest } from "next/server";
import { processReferenceDocument } from "@/lib/rag/processor";
import { requireAdmin } from "@/lib/admin/auth";

export const maxDuration = 300; // 5분

/**
 * POST /api/admin/references/[id]/process — OCR + 청킹 + 임베딩 (SSE)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireAdmin(request);
  if (denied) return denied;

  const { id } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of processReferenceDocument(id)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
        }
      } catch (error) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              step: "처리 중 오류가 발생했습니다",
              progress: -1,
            })}\n\n`
          )
        );
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
