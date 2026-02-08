import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service Role 클라이언트 (서버 전용)
 * - Cron Job, 파이프라인 등 인증 없이 DB 접근 필요한 경우
 * - RLS를 우회하므로 주의해서 사용
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
