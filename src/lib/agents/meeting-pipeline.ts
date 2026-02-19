/**
 * Agent Team Meeting Pipeline
 *
 * 순차 실행:
 * Phase 1: CDO → 서비스 지표 수집
 * Phase 2: CSO → 전략 회의 (변증법적 분석)
 * Phase 3: 각 팀 Chief → 팀 분석 + 실행 미션 3~5개
 * Phase 4: 노션 업로드
 * Phase 5: DB 저장
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { callClaude } from '@/lib/ai/claude';
import type {
  ServiceMetrics,
  StrategyOutput,
  TeamAnalysisOutput,
  MeetingPhase,
  TeamConfig,
} from './meeting-types';
import { MEETING_TEAMS } from './meeting-types';
import { TEAM_PROMPTS } from './meeting-prompts';
import { uploadMeetingToNotion } from './meeting-notion';

/** 메인 파이프라인 실행 */
export async function runMeetingPipeline(
  meetingId: string,
  meetingType: 'weekly' | 'monthly'
): Promise<void> {
  const supabase = createAdminClient();
  const startTime = Date.now();
  let totalTokens = 0;
  let totalCost = 0;

  try {
    // ─── Phase 1: CDO 서비스 지표 수집 ───────────────────
    await updateMeetingStatus(meetingId, 'collecting_metrics', 'CDO 서비스 지표 수집 중...');

    const rawData = await collectRawServiceData();
    const metrics = await runCdoMetricsCollection(rawData);

    const phase1Cost = estimateCost('haiku', 2000);
    totalTokens += 2000;
    totalCost += phase1Cost;

    await supabase
      .from('agent_meetings')
      .update({
        service_metrics: metrics as unknown as Record<string, unknown>,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      })
      .eq('id', meetingId);

    // ─── Phase 2: CSO 전략 회의 ──────────────────────────
    await updateMeetingStatus(meetingId, 'strategy_meeting', 'CSO 전략 회의 진행 중...');

    // 이전 회의 요약 가져오기
    const { data: prevMeeting } = await supabase
      .from('agent_meetings')
      .select('strategy_summary')
      .neq('id', meetingId)
      .eq('status', 'completed')
      .order('meeting_date', { ascending: false })
      .limit(1)
      .single();

    const csoPrompt = TEAM_PROMPTS['01-strategy'];
    const strategyResponse = await callClaude({
      model: 'claude-sonnet-4-20250514',
      system: csoPrompt.system,
      messages: [
        {
          role: 'user',
          content: `${csoPrompt.analysisInstructions}\n\n## 서비스 지표\n${JSON.stringify(metrics, null, 2)}\n\n## 회의 유형: ${meetingType}\n\n## 이전 회의 요약\n${prevMeeting?.strategy_summary || '없음 (첫 회의)'}`,
        },
      ],
      maxTokens: 4096,
      temperature: 0.7,
    });

    const strategyResult = safeParseJson<StrategyOutput>(strategyResponse);
    const strategySummary = buildStrategySummaryMarkdown(strategyResult);

    const phase2Cost = estimateCost('sonnet', 7000);
    totalTokens += 7000;
    totalCost += phase2Cost;

    await supabase
      .from('agent_meetings')
      .update({
        strategy_summary: strategySummary,
        strategy_result: strategyResult as unknown as Record<string, unknown>,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      })
      .eq('id', meetingId);

    // ─── Phase 3: 팀별 분석 ─────────────────────────────
    await updateMeetingStatus(meetingId, 'team_analysis', '팀별 분석 진행 중...');

    // 분석 대상 팀: CDO(13-data), CSO(01-strategy) 제외한 실행 팀들
    const analysisTeams = MEETING_TEAMS.filter(
      (t) => !['13-data', '01-strategy'].includes(t.id)
    );
    const teamReports: TeamAnalysisOutput[] = [];

    for (const team of analysisTeams) {
      // 해당 팀에 대한 CSO 지시사항 추출
      const decisions = strategyResult.decisions;
      const directive = decisions?.team_directives?.[team.id];
      const directiveText = directive
        ? `CSO 지시사항: ${directive}`
        : '전략 회의에서 별도 지시사항 없음. 자체 판단으로 분석하세요.';

      const teamPrompt = TEAM_PROMPTS[team.id];
      if (!teamPrompt) continue;

      const teamResponse = await callClaude({
        model: 'claude-sonnet-4-20250514',
        system: teamPrompt.system,
        messages: [
          {
            role: 'user',
            content: `${teamPrompt.analysisInstructions}\n\n## 서비스 지표\n${JSON.stringify(metrics, null, 2)}\n\n## ${directiveText}\n\n## 회의 유형: ${meetingType}`,
          },
        ],
        maxTokens: 3000,
        temperature: 0.7,
      });

      const teamAnalysis = safeParseJson<TeamAnalysisOutput>(teamResponse);
      teamAnalysis.team_id = team.id;
      teamAnalysis.team_name = team.name;
      teamAnalysis.chief = team.chief;

      teamReports.push(teamAnalysis);

      const teamCost = estimateCost('sonnet', 5000);
      totalTokens += 5000;
      totalCost += teamCost;
    }

    await supabase
      .from('agent_meetings')
      .update({
        team_reports: teamReports as unknown as Record<string, unknown>[],
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      })
      .eq('id', meetingId);

    // ─── Phase 4: 노션 업로드 ──────────────────────────
    await updateMeetingStatus(meetingId, 'uploading_notion', '노션 업로드 중...');

    // 회의 정보 가져오기
    const { data: meeting } = await supabase
      .from('agent_meetings')
      .select('meeting_date, week_number')
      .eq('id', meetingId)
      .single();

    // 노션 API로 보고서 + 미션 업로드
    let notionPageUrl: string | null = null;
    try {
      const notionResult = await uploadMeetingToNotion(
        meetingType,
        meeting?.meeting_date || new Date().toISOString().split('T')[0],
        meeting?.week_number || undefined,
        metrics,
        strategySummary,
        teamReports.map((r) => ({
          team_id: r.team_id,
          team_name: r.team_name,
          chief: r.chief,
          analysis_summary: r.analysis_summary || '',
          key_findings: r.key_findings || [],
          action_items: (r.action_items || []).map((a) => ({
            title: a.title,
            priority: a.priority,
            expected_outcome: a.expected_outcome,
            description: a.description,
            category: a.category,
            due_date: a.due_date,
          })),
        })),
        totalTokens,
        totalCost,
      );
      notionPageUrl = notionResult?.url || null;
    } catch (err) {
      console.warn('[Meeting Pipeline] Notion upload failed (non-critical):', err);
    }

    // ─── Phase 5: 미션 DB 저장 + 완료 ───────────────────
    const allMissions = teamReports.flatMap((report) =>
      (report.action_items || []).map((item) => ({
        meeting_id: meetingId,
        team_id: report.team_id,
        team_name: report.team_name,
        chief: report.chief,
        title: item.title,
        description: item.description,
        category: item.category || 'ops',
        priority: item.priority || 'medium',
        expected_outcome: item.expected_outcome,
        kpi_target: item.kpi_target || null,
        due_date: item.due_date || null,
      }))
    );

    if (allMissions.length > 0) {
      await supabase.from('agent_missions').insert(allMissions);
    }

    const durationMs = Date.now() - startTime;

    await supabase
      .from('agent_meetings')
      .update({
        status: 'completed',
        current_phase: null,
        notion_page_url: notionPageUrl,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
        duration_ms: durationMs,
      })
      .eq('id', meetingId);

    console.log(
      `[Meeting Pipeline] Completed in ${Math.round(durationMs / 1000)}s, ` +
      `${totalTokens} tokens, $${totalCost.toFixed(4)}, ${allMissions.length} missions`
    );
  } catch (error) {
    console.error('[Meeting Pipeline] Failed:', error);

    await supabase
      .from('agent_meetings')
      .update({
        status: 'failed',
        error_message: error instanceof Error ? error.message : String(error),
        duration_ms: Date.now() - startTime,
        total_tokens: totalTokens,
        total_cost_usd: totalCost,
      })
      .eq('id', meetingId);
  }
}

// ─── 헬퍼 함수들 ────────────────────────────────────────────

/** 회의 상태 업데이트 */
async function updateMeetingStatus(
  meetingId: string,
  status: string,
  currentPhase: string
) {
  const supabase = createAdminClient();
  await supabase
    .from('agent_meetings')
    .update({ status, current_phase: currentPhase })
    .eq('id', meetingId);
}

/** Supabase에서 원시 서비스 데이터 수집 */
async function collectRawServiceData(): Promise<Record<string, unknown>> {
  const supabase = createAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: totalUsers },
    { count: newUsersWeek },
    { count: totalPlans },
    { count: plansThisWeek },
    { data: subscriptions },
    { data: aiLogs },
    { count: totalPrograms },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('business_plans').select('*', { count: 'exact', head: true }),
    supabase.from('business_plans').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('subscriptions').select('plan_type, status').eq('status', 'active'),
    supabase.from('agent_logs').select('cost_usd, input_tokens, output_tokens, status').gte('created_at', sevenDaysAgo),
    supabase.from('programs').select('*', { count: 'exact', head: true }),
  ]);

  return {
    users: { total: totalUsers || 0, new_this_week: newUsersWeek || 0 },
    plans: { total: totalPlans || 0, this_week: plansThisWeek || 0 },
    subscriptions: subscriptions || [],
    ai_logs: aiLogs || [],
    programs: { total: totalPrograms || 0 },
  };
}

/** CDO 메트릭 수집 */
async function runCdoMetricsCollection(rawData: Record<string, unknown>): Promise<ServiceMetrics> {
  const cdoPrompt = TEAM_PROMPTS['13-data'];
  const response = await callClaude({
    model: 'claude-haiku-4-5-20251001',
    system: cdoPrompt.system,
    messages: [{ role: 'user', content: `${cdoPrompt.analysisInstructions}\n\n## 원시 데이터\n${JSON.stringify(rawData, null, 2)}` }],
    maxTokens: 2000,
    temperature: 0.3,
  });

  return safeParseJson<ServiceMetrics>(response);
}

/** 전략 요약 마크다운 변환 */
function buildStrategySummaryMarkdown(strategy: StrategyOutput): string {
  if (!strategy) return '전략 분석 결과를 파싱할 수 없습니다.';

  if (strategy.summary_markdown) {
    return strategy.summary_markdown;
  }

  const decisions = strategy.decisions;
  if (!decisions) return '전략 분석 결과를 파싱할 수 없습니다.';

  const parts = [
    '**집중 영역:**',
    ...(decisions.focus_areas || []).map((o: string) => `- ${o}`),
    '',
    '**개선 대상 지표:**',
    ...(decisions.key_metrics_to_improve || []).map((m: string) => `- ${m}`),
    '',
    '**리스크:**',
    ...(decisions.risk_alerts || []).map((r: string) => `- ${r}`),
  ];

  return parts.join('\n');
}


/** JSON 안전 파싱 (마크다운 코드블록 포함 대응) */
function safeParseJson<T>(text: string): T {
  try {
    // JSON 코드블록 추출
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1] : text;
    return JSON.parse(jsonStr.trim()) as T;
  } catch {
    // 직접 파싱 시도
    try {
      return JSON.parse(text.trim()) as T;
    } catch {
      console.warn('[Meeting Pipeline] JSON parse failed, returning empty object');
      return {} as T;
    }
  }
}

/** 토큰 기반 비용 추정 */
function estimateCost(model: 'haiku' | 'sonnet', tokens: number): number {
  const rates: Record<string, number> = {
    haiku: 0.0000008,   // $0.80 / 1M tokens (input+output blended)
    sonnet: 0.000006,   // $6.00 / 1M tokens (blended)
  };
  return tokens * (rates[model] || 0.000006);
}
