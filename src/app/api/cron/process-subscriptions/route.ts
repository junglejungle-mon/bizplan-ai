import { processExpiredSubscriptions } from '@/lib/payment/subscription';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/cron/process-subscriptions
 * Vercel Cron 트리거: 매일 00:00 UTC (09:00 KST)
 *
 * 1. 만료된 trial/구독 상태 변경
 * 2. 트라이얼 만료 D-3 알림 (카카오/인앱)
 * 3. 결과 요약 반환
 */
export async function GET(request: Request) {
  try {
    // Cron 시크릿 검증
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // ─── 1. 만료 처리 ────────────────────────────────
    const expired = await processExpiredSubscriptions();

    // ─── 2. 트라이얼 만료 D-3 알림 ──────────────────
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
    const threeDaysStr = threeDaysFromNow.toISOString();

    const now = new Date().toISOString();

    // D-3 이내 만료 예정인 trialing 구독 조회
    const { data: expiringTrials } = await supabase
      .from('subscriptions')
      .select('id, user_id, current_period_end, plan:subscription_plans(display_name)')
      .eq('status', 'trialing')
      .gt('current_period_end', now)
      .lte('current_period_end', threeDaysStr);

    let trialAlertsSent = 0;

    if (expiringTrials && expiringTrials.length > 0) {
      // 이미 알림 보낸 유저 제외 (notification_logs에서 확인)
      const userIds = expiringTrials.map((t) => t.user_id);
      const { data: alreadyNotified } = await supabase
        .from('notification_logs')
        .select('user_id')
        .eq('notification_type', 'trial_expiring')
        .in('user_id', userIds)
        .gte('created_at', new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString());

      const notifiedSet = new Set((alreadyNotified || []).map((n) => n.user_id));

      for (const trial of expiringTrials) {
        if (notifiedSet.has(trial.user_id)) continue;

        const daysLeft = Math.ceil(
          (new Date(trial.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const planName = (trial.plan as unknown as { display_name: string })?.display_name || 'Pro';

        // 인앱 알림 로그 저장 (카카오 알림톡은 Solapi 키 설정 시 자동 작동)
        await supabase.from('notification_logs').insert({
          user_id: trial.user_id,
          channel: 'in_app',
          notification_type: 'trial_expiring',
          template_id: null,
          recipient: trial.user_id,
          variables: {
            days_left: String(daysLeft),
            plan_name: planName,
            expiry_date: trial.current_period_end,
          },
          status: 'sent',
          sent_at: now,
        });

        // 카카오 알림톡 시도 (Solapi 키가 없으면 조용히 실패)
        try {
          if (process.env.SOLAPI_API_KEY && process.env.SOLAPI_TPL_DEADLINE) {
            const { sendKakaoNotification } = await import(
              '@/lib/notification/notification-service'
            );
            await sendKakaoNotification({
              userId: trial.user_id,
              type: 'deadline',
              variables: {
                '#{공고명}': `${planName} 무료 체험`,
                '#{남은일수}': String(daysLeft),
              },
            });
          }
        } catch {
          // Solapi 미설정 시 무시
        }

        trialAlertsSent++;
      }
    }

    // ─── 3. 유료 구독 만료 D-7 알림 ─────────────────
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
    const sevenDaysStr = sevenDaysFromNow.toISOString();

    const { data: expiringSubs } = await supabase
      .from('subscriptions')
      .select('id, user_id, current_period_end, plan:subscription_plans(display_name)')
      .eq('status', 'active')
      .eq('cancel_at_period_end', true)
      .gt('current_period_end', now)
      .lte('current_period_end', sevenDaysStr);

    let subAlertsSent = 0;

    if (expiringSubs && expiringSubs.length > 0) {
      const userIds = expiringSubs.map((s) => s.user_id);
      const { data: alreadyNotified } = await supabase
        .from('notification_logs')
        .select('user_id')
        .eq('notification_type', 'subscription_expiring')
        .in('user_id', userIds)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

      const notifiedSet = new Set((alreadyNotified || []).map((n) => n.user_id));

      for (const sub of expiringSubs) {
        if (notifiedSet.has(sub.user_id)) continue;

        const daysLeft = Math.ceil(
          (new Date(sub.current_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        const planName = (sub.plan as unknown as { display_name: string })?.display_name || '';

        await supabase.from('notification_logs').insert({
          user_id: sub.user_id,
          channel: 'in_app',
          notification_type: 'subscription_expiring',
          template_id: null,
          recipient: sub.user_id,
          variables: {
            days_left: String(daysLeft),
            plan_name: planName,
            expiry_date: sub.current_period_end,
          },
          status: 'sent',
          sent_at: now,
        });

        subAlertsSent++;
      }
    }

    return Response.json({
      success: true,
      timestamp: now,
      expired: {
        trials: expired.trials,
        subscriptions: expired.subscriptions,
      },
      alerts: {
        trial_expiring: trialAlertsSent,
        subscription_expiring: subAlertsSent,
      },
    });
  } catch (error) {
    console.error('[Cron] process-subscriptions error:', error);
    return Response.json(
      { error: 'Subscription processing failed' },
      { status: 500 }
    );
  }
}
