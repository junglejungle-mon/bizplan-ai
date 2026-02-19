import { createAdminClient } from '@/lib/supabase/admin';
import { cache } from '@/lib/redis';
import { adminLogger as log } from '@/lib/logger';
import { requireAdmin } from "@/lib/admin/auth";
import { apiError } from "@/lib/api/error";

export async function GET(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search');
    const source = searchParams.get('source');
    const status = searchParams.get('status'); // 'active' | 'expired' | 'upcoming'
    const institution = searchParams.get('institution');
    const applyStartFrom = searchParams.get('apply_start_from');
    const applyStartTo = searchParams.get('apply_start_to');
    const applyEndFrom = searchParams.get('apply_end_from');
    const applyEndTo = searchParams.get('apply_end_to');
    const sort = searchParams.get('sort') || 'collected_at';
    const order = searchParams.get('order') || 'desc';

    let query = supabase
      .from('programs')
      .select('id, title, source, target, apply_start, apply_end, institution, detail_url, collected_at, hashtags', { count: 'exact' });

    // 텍스트 검색 (제목 + 기관명)
    if (search) {
      query = query.or(`title.ilike.%${search}%,institution.ilike.%${search}%,target.ilike.%${search}%`);
    }

    // 출처 필터
    if (source) {
      query = query.eq('source', source);
    }

    // 기관명 필터
    if (institution) {
      query = query.ilike('institution', `%${institution}%`);
    }

    // 상태 필터 (마감일 기준)
    const now = new Date().toISOString();
    if (status === 'active') {
      query = query.or(`apply_end.is.null,apply_end.gte.${now}`);
    } else if (status === 'expired') {
      query = query.lt('apply_end', now).not('apply_end', 'is', null);
    } else if (status === 'upcoming') {
      query = query.gt('apply_start', now);
    }

    // 접수 시작일 범위
    if (applyStartFrom) {
      query = query.gte('apply_start', applyStartFrom);
    }
    if (applyStartTo) {
      query = query.lte('apply_start', applyStartTo);
    }

    // 접수 마감일 범위
    if (applyEndFrom) {
      query = query.gte('apply_end', applyEndFrom);
    }
    if (applyEndTo) {
      query = query.lte('apply_end', applyEndTo);
    }

    // 정렬
    const validSortFields = ['collected_at', 'apply_start', 'apply_end', 'title', 'institution'];
    const sortField = validSortFields.includes(sort) ? sort : 'collected_at';

    const from = (page - 1) * limit;
    query = query
      .order(sortField, { ascending: order === 'asc' })
      .range(from, from + limit - 1);

    const { data: programs, count, error } = await query;

    if (error) {
      return apiError(error, "프로그램 목록 조회 실패", 500);
    }

    // 기관 목록 조회 (필터 드롭다운용) — Redis 캐싱 (1시간)
    const uniqueInstitutions = await cache.getOrSet<string[]>(
      'programs:institutions',
      3600,
      async () => {
        const { data: institutions } = await supabase
          .from('programs')
          .select('institution')
          .not('institution', 'is', null)
          .not('institution', 'eq', '');
        return [...new Set((institutions || []).map((i: any) => i.institution).filter(Boolean))].sort();
      },
    );

    return Response.json({
      programs: programs || [],
      total: count || 0,
      page,
      limit,
      institutions: uniqueInstitutions,
    });
  } catch (error) {
    log.error({ err: error }, '프로그램 목록 조회 실패');
    return Response.json({ error: 'Failed to fetch programs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const denied = await requireAdmin(request);
    if (denied) return denied;

    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const response = await fetch(`${baseUrl}/api/programs/collect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cronSecret}`,
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return Response.json({ error: 'Collection trigger failed', details: result }, { status: response.status });
    }

    return Response.json({ message: 'Program collection triggered', result });
  } catch (error) {
    log.error({ err: error }, '프로그램 수집 트리거 실패');
    return Response.json({ error: 'Failed to trigger program collection' }, { status: 500 });
  }
}
