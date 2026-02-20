import { createAdminClient } from '@/lib/supabase/admin';
import { sendBulkKakaoNotification } from '@/lib/notification/notification-service';

/**
 * GET /api/cron/retarget
 * Vercel Cron 트리거: 매일 22:00 UTC (07:00 KST)
 *
 * 이탈 사용자 리타게팅 시퀀스 (카카오 알림톡):
 *
 * 시퀀스 1: 비활성 사용자 (가입 후 3일 경과, 로그인 없음)
 *   → "#{이름}님, BizPlan AI에서 무료 사업계획서를 만들어보세요!"
 *
 * 시퀀스 2: 사업계획서 미생성 (가입 후 7일 경과, 계획서 0건)
 *   → "#{이름}님, AI가 5분 만에 사업계획서를 작성해드립니다."
 *
 * 시퀀스 3: 인터뷰 미완료 (인터뷰 시작했지만 5라운드 미완)
 *   → "#{이름}님, 남은 인터뷰를 완료하면 더 정확한 계획서를 받으실 수 있어요."
 *
 * 중복 방지: notification_logs에서 최근 7일 내 동일 유형 발송 여부 확인
 */
export async function GET(request: Request) {
  try {
    // Cron 시크릿 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();

    const results = {
      retarget_inactive: { total: 0, sent: 0, skipped: 0 },
      retarget_no_plan: { total: 0, sent: 0, skipped: 0 },
      retarget_incomplete_interview: { total: 0, sent: 0, skipped: 0 },
    };

    // ─── 시퀀스 1: 비활성 사용자 (3일 이상 미로그인) ───────
    try {
      // auth.users에서 최근 로그인 없는 사용자 조회
      const { data: authData } = await supabase.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

      if (authData?.users) {
        // 3일 전에 가입했지만 3일 이상 로그인 안 한 사용자
        const inactiveUsers = authData.users.filter((u) => {
          const createdAt = new Date(u.created_at);
          const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at) : null;
          const isOldEnough = createdAt <= new Date(threeDaysAgo);
          const isInactive = !lastLogin || lastLogin <= new Date(threeDaysAgo);
          return isOldEnough && isInactive;
        });

        if (inactiveUsers.length > 0) {
          // 최근 7일 내 이미 리타게팅 발송한 유저 제외
          const inactiveIds = inactiveUsers.map((u) => u.id);
          const { data: alreadySent } = await supabase
            .from('notification_logs')
            .select('user_id')
            .eq('notification_type', 'retarget_inactive')
            .in('user_id', inactiveIds)
            .gte('created_at', sevenDaysAgo);

          const sentSet = new Set((alreadySent || []).map((n) => n.user_id));
          const targets = inactiveUsers.filter((u) => !sentSet.has(u.id));

          if (targets.length > 0) {
            // 이름 조회
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, name')
              .in('id', targets.map((u) => u.id));

            const nameMap = new Map(
              (profiles || []).map((p: { id: string; name: string | null }) => [p.id, p.name || '고객'])
            );

            const userVariables = new Map<string, Record<string, string>>();
            for (const user of targets) {
              userVariables.set(user.id, {
                '#{이름}': nameMap.get(user.id) || '고객',
              });
            }

            results.retarget_inactive = await sendBulkKakaoNotification({
              type: 'retarget_inactive',
              userVariables,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Retarget] 비활성 사용자 처리 실패:', err);
    }

    // ─── 시퀀스 2: 사업계획서 미생성 (7일 경과) ───────────
    try {
      // 7일 전에 가입했지만 사업계획서가 없는 기업
      const { data: companiesWithoutPlans } = await supabase
        .from('companies')
        .select('id, user_id, company_name')
        .lte('created_at', sevenDaysAgo);

      if (companiesWithoutPlans && companiesWithoutPlans.length > 0) {
        const companyIds = companiesWithoutPlans.map((c) => c.id);

        // 이미 계획서가 있는 기업 제외
        const { data: plansExist } = await supabase
          .from('business_plans')
          .select('company_id')
          .in('company_id', companyIds);

        const hasPlansSet = new Set(
          (plansExist || []).map((p: { company_id: string }) => p.company_id)
        );
        const noPlanCompanies = companiesWithoutPlans.filter(
          (c) => !hasPlansSet.has(c.id)
        );

        if (noPlanCompanies.length > 0) {
          // 중복 제거
          const noPlanUserIds = noPlanCompanies.map((c) => c.user_id);
          const { data: alreadySent } = await supabase
            .from('notification_logs')
            .select('user_id')
            .eq('notification_type', 'retarget_no_plan')
            .in('user_id', noPlanUserIds)
            .gte('created_at', sevenDaysAgo);

          const sentSet = new Set((alreadySent || []).map((n) => n.user_id));

          const userVariables = new Map<string, Record<string, string>>();
          for (const company of noPlanCompanies) {
            if (sentSet.has(company.user_id)) continue;
            userVariables.set(company.user_id, {
              '#{이름}': company.company_name || '고객',
            });
          }

          if (userVariables.size > 0) {
            results.retarget_no_plan = await sendBulkKakaoNotification({
              type: 'retarget_no_plan',
              userVariables,
            });
          }
        }
      }
    } catch (err) {
      console.error('[Retarget] 계획서 미생성 처리 실패:', err);
    }

    // ─── 시퀀스 3: 인터뷰 미완료 ─────────────────────────
    try {
      // 인터뷰를 시작했지만 round 5를 완료하지 않은 기업
      const { data: interviewData } = await supabase
        .from('company_interviews')
        .select('company_id, round')
        .order('round', { ascending: false });

      if (interviewData && interviewData.length > 0) {
        // 기업별 최대 round 집계
        const companyMaxRound = new Map<string, number>();
        for (const row of interviewData) {
          const current = companyMaxRound.get(row.company_id) || 0;
          if (row.round > current) {
            companyMaxRound.set(row.company_id, row.round);
          }
        }

        // round < 5인 기업만 (시작은 했지만 미완료)
        const incompleteCompanyIds = Array.from(companyMaxRound.entries())
          .filter(([, maxRound]) => maxRound > 0 && maxRound < 5)
          .map(([companyId]) => companyId);

        if (incompleteCompanyIds.length > 0) {
          // 기업 → 유저 매핑
          const { data: companies } = await supabase
            .from('companies')
            .select('id, user_id, company_name')
            .in('id', incompleteCompanyIds);

          if (companies && companies.length > 0) {
            const userIds = companies.map((c) => c.user_id);

            // 중복 제거
            const { data: alreadySent } = await supabase
              .from('notification_logs')
              .select('user_id')
              .eq('notification_type', 'retarget_incomplete_interview')
              .in('user_id', userIds)
              .gte('created_at', sevenDaysAgo);

            const sentSet = new Set((alreadySent || []).map((n) => n.user_id));

            const userVariables = new Map<string, Record<string, string>>();
            for (const company of companies) {
              if (sentSet.has(company.user_id)) continue;
              const maxRound = companyMaxRound.get(company.id) || 0;
              userVariables.set(company.user_id, {
                '#{이름}': company.company_name || '고객',
                '#{완료라운드}': String(maxRound),
                '#{남은라운드}': String(5 - maxRound),
              });
            }

            if (userVariables.size > 0) {
              results.retarget_incomplete_interview = await sendBulkKakaoNotification({
                type: 'retarget_incomplete_interview',
                userVariables,
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('[Retarget] 인터뷰 미완료 처리 실패:', err);
    }

    return Response.json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (error) {
    console.error('[Cron] retarget error:', error);
    return Response.json(
      { error: 'Retarget processing failed' },
      { status: 500 }
    );
  }
}
