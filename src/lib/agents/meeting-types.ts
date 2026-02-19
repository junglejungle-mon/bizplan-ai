/**
 * 에이전트 팀 회의 파이프라인 타입 정의
 */

export interface ServiceMetrics {
  snapshot_date: string;
  users: { total: number; new_this_week: number; dau_avg: number; retention_7d: number };
  plans: { total: number; this_week: number; avg_quality_score: number; completion_rate: number };
  subscriptions: { active: number; pro: number; enterprise: number; trial: number; churn_rate: number; mrr: number };
  payments: { total_revenue: number; this_week_revenue: number; avg_arpu: number; refund_rate: number };
  ai: { weekly_tokens: number; weekly_cost: number; cost_per_plan: number; avg_generation_time_ms: number };
  programs: { total_active: number; new_this_week: number; total_matchings: number; avg_match_score: number };
}

export interface ActionItem {
  title: string;
  description: string;
  category: "strategy" | "marketing" | "product" | "tech" | "data" | "growth" | "ops";
  priority: "critical" | "high" | "medium" | "low";
  expected_outcome: string;
  kpi_target?: Record<string, unknown>;
  due_date?: string;
}

export interface TeamAnalysisOutput {
  team_id: string;
  team_name: string;
  chief: string;
  analysis_summary: string;
  key_findings: string[];
  action_items: ActionItem[];
}

export interface StrategyDecision {
  focus_areas: string[];
  key_metrics_to_improve: string[];
  risk_alerts: string[];
  team_directives: Record<string, string>;
}

export interface StrategyOutput {
  summary_markdown: string;
  decisions: StrategyDecision;
}

export type MeetingPhase =
  | "collecting_metrics" | "strategy_meeting" | "team_analysis"
  | "uploading_notion" | "saving_missions" | "completed" | "failed";

export interface PipelineResult {
  meetingId: string;
  success: boolean;
  metrics?: ServiceMetrics;
  strategy?: StrategyOutput;
  teamReports?: TeamAnalysisOutput[];
  notionPageUrl?: string;
  totalTokens: number;
  totalCostUsd: number;
  durationMs: number;
  error?: string;
}

export interface TeamConfig {
  id: string;
  name: string;
  chief: string;
  role: string;
  focusAreas: string[];
}

export const MEETING_TEAMS: TeamConfig[] = [
  { id: "13-data", name: "데이터 & BI", chief: "CDO", role: "서비스 지표 수집 및 분석", focusAreas: ["서비스 지표", "AI 품질", "사용자 행동", "비용 효율"] },
  { id: "01-strategy", name: "CEO 전략사령부", chief: "CSO", role: "전략 회의 총괄 및 방향 수립", focusAreas: ["사업 전략", "KPI 설정", "경쟁 분석", "리스크 관리"] },
  { id: "02-marketing", name: "마케팅 & 브랜드", chief: "CMO", role: "유저 획득, 전환율, 콘텐츠 전략", focusAreas: ["유저 획득", "전환율 최적화", "브랜드 인지도", "콘텐츠 마케팅"] },
  { id: "05-ecommerce", name: "커머스 사업부", chief: "CComO", role: "구독/결제 전환, 요금제 최적화", focusAreas: ["구독 전환율", "결제 흐름", "요금제 전략", "이탈 방지"] },
  { id: "09-bizdev", name: "사업개발 & IR", chief: "CBDO", role: "지원사업 파이프라인, 파트너십", focusAreas: ["지원사업 매칭", "파트너십", "투자유치", "공고 분석"] },
];
