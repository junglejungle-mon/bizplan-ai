"use client";

import { useCallback, useEffect, useState } from "react";

// ─── 타입 ─────────────────────────────────────

interface Pattern {
  id: string;
  category: string;
  subcategory: string;
  title: string;
  description: string;
  good_examples: string[];
  bad_examples: string[];
  weight: number;
  is_active: boolean;
}

interface AgentLog {
  id: string;
  skill_name: string;
  action: string;
  status: string;
  input_tokens: number;
  output_tokens: number;
  model_used: string;
  cost_usd: number;
  duration_ms: number;
  created_at: string;
}

interface Mission {
  id: string;
  meeting_id: string;
  team_id: string;
  team_name: string;
  chief: string;
  title: string;
  description: string | null;
  category: string;
  priority: string;
  expected_outcome: string | null;
  kpi_target: Record<string, unknown> | null;
  approval_status: string;
  approved_at: string | null;
  rejection_reason: string | null;
  execution_status: string;
  due_date: string | null;
  created_at: string;
}

interface Meeting {
  id: string;
  meeting_type: string;
  meeting_date: string;
  week_number: number | null;
  status: string;
  current_phase: string | null;
  strategy_summary: string | null;
  notion_page_url: string | null;
  total_tokens: number;
  total_cost_usd: number;
  duration_ms: number | null;
  triggered_by: string;
  error_message: string | null;
  created_at: string;
}

interface KpiData {
  users: { total: number; new_this_week: number };
  plans: { total: number; this_week: number };
  subscriptions: { active: number; pro: number; enterprise: number };
  ai: { weekly_cost: number; weekly_tokens: number; cost_per_plan: number };
  programs: { total: number };
  meetings: { recent_count: number; missions: { total: number; pending: number; approved: number; completed: number } };
}

type TeamStatus = "active" | "standby" | "planned";
type TeamCategory = "core" | "revenue" | "support" | "growth" | "special";

interface TeamInfo {
  id: string;
  name: string;
  nameEn: string;
  chief: string;
  chiefTitle: string;
  desc: string;
  agents: number;
  status: TeamStatus;
  category: TeamCategory;
  keyAgents: string[];
}

// ─── 22개 팀 전체 카탈로그 ─────────────────────

const TEAM_CATALOG: TeamInfo[] = [
  // === CORE (핵심 운영) ===
  {
    id: "00-quality-team",
    name: "거버넌스 & 감시위원회",
    nameEn: "Governance & Audit",
    chief: "CGvO",
    chiefTitle: "Chief Governance Officer",
    desc: "전 사업부 품질 감사 + 거버넌스 + 리스크 관리",
    agents: 10,
    status: "active",
    category: "core",
    keyAgents: ["Quality Manager", "Fact Checker", "Logic Validator", "Bias Detector", "Compliance Monitor"],
  },
  {
    id: "01-ceo-strategy-team",
    name: "CEO 전략사령부",
    nameEn: "CEO Strategic Command",
    chief: "CSO",
    chiefTitle: "Chief Strategy Officer",
    desc: "사업계획서 기술/R&D 전략 방향 수립 + TRL 관점 품질 검증",
    agents: 12,
    status: "active",
    category: "core",
    keyAgents: ["Market Analyst", "Risk Analyst", "Innovator", "Pessimist", "Optimist", "Realist"],
  },
  {
    id: "26-business-plan-team",
    name: "사업계획서 작성팀",
    nameEn: "Business Plan Writing",
    chief: "CBPO",
    chiefTitle: "Chief Business Planning Officer",
    desc: "정부지원사업 사업계획서 AI 작성 (선정 12건 패턴 학습)",
    agents: 6,
    status: "active",
    category: "core",
    keyAgents: ["Proposal Writer", "Market Researcher", "Financial Modeler", "Quality Reviewer"],
  },
  {
    id: "17-ir-ppt-writer",
    name: "IR & 프레젠테이션",
    nameEn: "IR & Presentation",
    chief: "CommO",
    chiefTitle: "Chief Communications Officer",
    desc: "IR 피치덱 자동 생성 + 연례보고서 + 위기소통",
    agents: 8,
    status: "active",
    category: "core",
    keyAgents: ["IR PPT Writer", "Annual Report Writer", "Crisis Communication Specialist", "Speechwriter"],
  },
  {
    id: "23-qa-standards-team",
    name: "품질보증 & 표준",
    nameEn: "QA & Standards",
    chief: "CQO",
    chiefTitle: "Chief Quality Officer",
    desc: "콘텐츠/제품 QA + 표준화 실행",
    agents: 10,
    status: "standby",
    category: "core",
    keyAgents: ["Content QA Lead", "Product QA Lead", "Test Automation Engineer", "Standards Manager"],
  },

  // === REVENUE (매출/마케팅) ===
  {
    id: "02-marketing-team",
    name: "CMO 마케팅 사업부",
    nameEn: "Marketing & Brand",
    chief: "CMO",
    chiefTitle: "Chief Marketing Officer",
    desc: "사업계획서 마케팅/사업화 전략 섹션 전문 작성 + 시장 인텔리전스",
    agents: 12,
    status: "active",
    category: "revenue",
    keyAgents: ["Copywriter", "SEO Specialist", "Performance Marketer", "Brand Strategist", "Growth Hacker"],
  },
  {
    id: "05-ecommerce-team",
    name: "커머스 사업부",
    nameEn: "Commerce Division",
    chief: "CComO",
    chiefTitle: "Chief Commerce Officer",
    desc: "상세페이지 자동화 + D2C/B2B/구독 커머스 전략",
    agents: 12,
    status: "standby",
    category: "revenue",
    keyAgents: ["Detail Page Planner", "D2C Expert", "B2B Sales Manager", "Marketplace Manager"],
  },
  {
    id: "11-channel-team",
    name: "채널운영 사업부",
    nameEn: "Channel Operations",
    chief: "ChO",
    chiefTitle: "Chief Channel Officer",
    desc: "127개 채널 모니터링 + 글로벌 플랫폼 + 정산 관리",
    agents: 10,
    status: "standby",
    category: "revenue",
    keyAgents: ["Platform Expert", "Performance Analyst", "Global Platform Specialist", "Settlement Manager"],
  },
  {
    id: "09-business-dev-team",
    name: "사업개발 & IR",
    nameEn: "Business Development",
    chief: "CBDO",
    chiefTitle: "Chief Business Dev Officer",
    desc: "사업계획서 설득력 강화 + 평가위원 관점 최적화 + 공고 분석",
    agents: 10,
    status: "active",
    category: "revenue",
    keyAgents: ["Strategy Agent", "Section Writer", "Valuation Expert", "Partnership Manager"],
  },

  // === SUPPORT (지원/인프라) ===
  {
    id: "06-finance-team",
    name: "CFO 재무 사업부",
    nameEn: "Finance & Accounting",
    chief: "CFO",
    chiefTitle: "Chief Financial Officer",
    desc: "사업계획서 재무/예산 섹션 전문 작성 + 수치 일관성 검증",
    agents: 12,
    status: "active",
    category: "support",
    keyAgents: ["Finance Manager", "FP&A Expert", "Tax Specialist", "Cash Manager", "Internal Auditor"],
  },
  {
    id: "07-admin-team",
    name: "COO 경영지원 사업부",
    nameEn: "Operations & Management",
    chief: "COO",
    chiefTitle: "Chief Operating Officer",
    desc: "행정문서 + 계약 + 일정 + 운영 관리",
    agents: 10,
    status: "standby",
    category: "support",
    keyAgents: ["Document Writer", "Scheduling Agent", "Procurement Manager", "Process Improvement"],
  },
  {
    id: "13-data-team",
    name: "데이터 & BI 사업부",
    nameEn: "Data & BI",
    chief: "CDO",
    chiefTitle: "Chief Data Officer",
    desc: "사업계획서 시장 데이터/통계 근거 강화 + 수치 일관성 검증",
    agents: 14,
    status: "active",
    category: "support",
    keyAgents: ["Data Manager", "Collector Agent", "Predictive Analytics Expert", "BI Dashboard Developer"],
  },
  {
    id: "15-web-dev-team",
    name: "기술 & 웹 사업부",
    nameEn: "Technology & Web",
    chief: "CTO",
    chiefTitle: "Chief Technology Officer",
    desc: "풀스택 웹 개발 + 백엔드 + 모바일 + 보안 + DevOps",
    agents: 10,
    status: "standby",
    category: "support",
    keyAgents: ["Frontend Developer", "Backend Developer", "Security Engineer", "DevOps Engineer"],
  },
  {
    id: "18-ai-rnd-team",
    name: "AI R&D & 서비스",
    nameEn: "AI R&D & Service",
    chief: "CAIO",
    chiefTitle: "Chief AI Officer",
    desc: "AI 제품 개발 + 모델 운영 + AI 서비스 배포",
    agents: 14,
    status: "standby",
    category: "support",
    keyAgents: ["ML Engineer", "Data Scientist", "MLOps Engineer", "Prompt Engineer", "NLP Specialist"],
  },
  {
    id: "14-cs-team",
    name: "고객경험 사업부",
    nameEn: "Customer Experience",
    chief: "CXO",
    chiefTitle: "Chief Experience Officer",
    desc: "고객 상담 + 클레임 + 리뷰 관리 + NPS + 옴니채널",
    agents: 12,
    status: "standby",
    category: "support",
    keyAgents: ["Counselor", "Claims Specialist", "VOC Analyzer", "Customer Success Manager"],
  },

  // === GROWTH (성장/확장) ===
  {
    id: "03-content-team",
    name: "콘텐츠 스튜디오",
    nameEn: "Content Studio",
    chief: "CCO",
    chiefTitle: "Chief Content Officer",
    desc: "숏폼/롱폼 영상 대본 + 팟캐스트 + 로컬라이제이션",
    agents: 10,
    status: "standby",
    category: "growth",
    keyAgents: ["Shortform Specialist", "Longform Specialist", "Script Writer", "Podcast Producer"],
  },
  {
    id: "04-visual-team",
    name: "크리에이티브 & 디자인",
    nameEn: "Creative & Design",
    chief: "CCrO",
    chiefTitle: "Chief Creative Officer",
    desc: "브랜드 시각 콘텐츠 + 패키징 + UX/UI + 3D",
    agents: 10,
    status: "standby",
    category: "growth",
    keyAgents: ["Art Director", "Thumbnail Designer", "Packaging Designer", "UX/UI Designer"],
  },
  {
    id: "08-education-team",
    name: "교육 & 아카데미",
    nameEn: "Education & Academy",
    chief: "CLO",
    chiefTitle: "Chief Learning Officer",
    desc: "강의자료 + PPT + 교안 + LMS 통합",
    agents: 8,
    status: "standby",
    category: "growth",
    keyAgents: ["Script Writer", "Slide Designer", "PPT Assembler", "LMS Integration Specialist"],
  },
  {
    id: "10-brainstorming-team",
    name: "이노베이션 랩",
    nameEn: "Innovation Lab",
    chief: "CINO",
    chiefTitle: "Chief Innovation Officer",
    desc: "아이디어 생성 → 검증 → 프로토타이핑 (토론 기반)",
    agents: 8,
    status: "standby",
    category: "growth",
    keyAgents: ["Creative Discussant", "Critical Discussant", "Design Thinking Facilitator", "Prototype Engineer"],
  },
  {
    id: "12-product-team",
    name: "제품개발 사업부",
    nameEn: "Product Development",
    chief: "CPO",
    chiefTitle: "Chief Product Officer",
    desc: "사업계획서 기술/제품/R&D 섹션 전문 작성 + TRL/특허 전략",
    agents: 12,
    status: "active",
    category: "growth",
    keyAgents: ["Product Manager", "R&D Researcher", "Patent Analyst", "Product Test Engineer"],
  },
  {
    id: "16-overseas-team",
    name: "글로벌확장 사업부",
    nameEn: "Global Expansion",
    chief: "CGO",
    chiefTitle: "Chief Growth Officer",
    desc: "사업계획서 해외진출/수출 전략 섹션 전문 작성 + 수출바우처 연계",
    agents: 12,
    status: "active",
    category: "growth",
    keyAgents: ["FDA Compliance", "Amazon Launch Specialist", "Export Voucher Manager", "Global Logistics Expert"],
  },

  // === SPECIAL (특수 사업부) ===
  {
    id: "25-bebe-team",
    name: "베베(경제킹베베) 전담",
    nameEn: "Bebe Financial Education",
    chief: "Bebe Brand Director",
    chiefTitle: "Brand Director",
    desc: "경제킹베베 콘텐츠 기획 → 제작 → 유통 → 커뮤니티",
    agents: 10,
    status: "standby",
    category: "special",
    keyAgents: ["Financial Educator", "Content Creator", "Video Producer", "Community Manager"],
  },
];

const CATEGORY_LABELS: Record<TeamCategory, { label: string; color: string; bg: string }> = {
  core: { label: "핵심 운영", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  revenue: { label: "매출/마케팅", color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  support: { label: "지원/인프라", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  growth: { label: "성장/확장", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  special: { label: "특수 사업부", color: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
};

const STATUS_LABELS: Record<TeamStatus, { label: string; dot: string; bg: string }> = {
  active: { label: "활성", dot: "bg-green-500", bg: "bg-green-50 text-green-700" },
  standby: { label: "대기", dot: "bg-yellow-500", bg: "bg-yellow-50 text-yellow-700" },
  planned: { label: "예정", dot: "bg-gray-400", bg: "bg-gray-100 text-gray-500" },
};

// ─── 컴포넌트 ──────────────────────────────────

export default function AdminAgentsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionStats, setMissionStats] = useState({ total: 0, pending_approval: 0, approved: 0, in_progress: 0, completed: 0 });
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [tab, setTab] = useState<"teams" | "missions" | "meetings" | "patterns" | "logs">("teams");
  const [loading, setLoading] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<TeamCategory | "all">("all");
  const [statusFilter, setStatusFilter] = useState<TeamStatus | "all">("all");
  const [expandedTeam, setExpandedTeam] = useState<string | null>(null);
  const [missionFilter, setMissionFilter] = useState<string>("all");
  const [expandedMission, setExpandedMission] = useState<string | null>(null);
  const [triggeringMeeting, setTriggeringMeeting] = useState(false);
  const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

  const fetchMissions = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/agents/missions")
      .then((r) => r.json())
      .then((data) => {
        setMissions(data.missions || []);
        setMissionStats(data.stats || { total: 0, pending_approval: 0, approved: 0, in_progress: 0, completed: 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const fetchMeetings = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/agents/meeting").then((r) => r.json()),
      fetch("/api/admin/agents/kpi").then((r) => r.json()),
    ])
      .then(([meetingData, kpiData]) => {
        setMeetings(meetingData.meetings || []);
        setKpi(kpiData.kpi || null);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (tab === "patterns") {
      setLoading(true);
      fetch("/api/admin/quality/patterns")
        .then((r) => r.json())
        .then((data) => setPatterns(data.patterns || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    if (tab === "logs") {
      setLoading(true);
      fetch("/api/admin/system/status")
        .then((r) => r.json())
        .then((data) => setLogs(data.recentLogs || []))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
    if (tab === "missions") fetchMissions();
    if (tab === "meetings") fetchMeetings();
  }, [tab, fetchMissions, fetchMeetings]);

  const filteredTeams = TEAM_CATALOG.filter((t) => {
    if (categoryFilter !== "all" && t.category !== categoryFilter) return false;
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    return true;
  });

  const totalAgents = TEAM_CATALOG.reduce((sum, t) => sum + t.agents, 0);
  const activeTeams = TEAM_CATALOG.filter((t) => t.status === "active").length;
  const standbyTeams = TEAM_CATALOG.filter((t) => t.status === "standby").length;

  const toggleExpand = useCallback((id: string) => {
    setExpandedTeam((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">에이전트 팀 관리</h1>
          <p className="text-sm text-gray-500 mt-1">정글몬스터 AI 에이전트 시스템 — 22개 팀, {totalAgents}명</p>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{TEAM_CATALOG.length}</div>
          <div className="text-xs text-gray-500">전체 팀</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeTeams}</div>
          <div className="text-xs text-gray-500">활성 팀</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-yellow-600">{standbyTeams}</div>
          <div className="text-xs text-gray-500">대기 팀</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-blue-600">{totalAgents}</div>
          <div className="text-xs text-gray-500">총 에이전트</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 overflow-x-auto">
        {[
          { key: "teams" as const, label: `팀 카탈로그 (${TEAM_CATALOG.length})` },
          { key: "missions" as const, label: `미션 보드${missionStats.pending_approval > 0 ? ` (${missionStats.pending_approval})` : ""}` },
          { key: "meetings" as const, label: "주간 회의" },
          { key: "patterns" as const, label: "선정 패턴" },
          { key: "logs" as const, label: "실행 로그" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ 팀 카탈로그 ═══ */}
      {tab === "teams" && (
        <div>
          {/* 필터 */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">카테고리:</span>
              <div className="flex gap-1">
                {(["all", "core", "revenue", "support", "growth", "special"] as const).map((c) => (
                  <button
                    key={c}
                    onClick={() => setCategoryFilter(c)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      categoryFilter === c
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {c === "all" ? "전체" : CATEGORY_LABELS[c].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 font-medium">상태:</span>
              <div className="flex gap-1">
                {(["all", "active", "standby", "planned"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      statusFilter === s
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    {s === "all" ? "전체" : STATUS_LABELS[s].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 팀 카드 목록 */}
          <div className="space-y-3">
            {filteredTeams.map((team) => {
              const catInfo = CATEGORY_LABELS[team.category];
              const statusInfo = STATUS_LABELS[team.status];
              const isExpanded = expandedTeam === team.id;

              return (
                <div
                  key={team.id}
                  className={`bg-white rounded-xl border transition-all ${
                    isExpanded ? "border-blue-300 shadow-sm" : "border-gray-200"
                  }`}
                >
                  {/* 메인 행 */}
                  <button
                    onClick={() => toggleExpand(team.id)}
                    className="w-full text-left px-5 py-4 flex items-center gap-4"
                  >
                    {/* 상태 점 */}
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusInfo.dot}`} />

                    {/* Chief 배지 */}
                    <div className="w-14 text-center flex-shrink-0">
                      <div className="text-xs font-bold text-gray-900">{team.chief}</div>
                    </div>

                    {/* 팀 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">{team.name}</h3>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catInfo.bg} ${catInfo.color}`}>
                          {catInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{team.desc}</p>
                    </div>

                    {/* 에이전트 수 */}
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-gray-700">{team.agents}명</div>
                      <div className="text-[10px] text-gray-400">에이전트</div>
                    </div>

                    {/* 상태 배지 */}
                    <div className="flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusInfo.bg}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    {/* 화살표 */}
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* 확장 상세 */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-gray-100 pt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 기본 정보 */}
                        <div>
                          <div className="text-xs font-medium text-gray-600 mb-2">팀 정보</div>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">ID</span>
                              <span className="font-mono text-gray-600">{team.id}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">영문명</span>
                              <span className="text-gray-600">{team.nameEn}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">Chief</span>
                              <span className="text-gray-600">{team.chiefTitle}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-400">에이전트</span>
                              <span className="font-semibold text-gray-700">{team.agents}명</span>
                            </div>
                          </div>
                        </div>

                        {/* 주요 에이전트 */}
                        <div className="md:col-span-2">
                          <div className="text-xs font-medium text-gray-600 mb-2">
                            주요 에이전트 ({team.keyAgents.length}명)
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {team.keyAgents.map((agent, i) => (
                              <span
                                key={i}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-md"
                              >
                                {agent}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {filteredTeams.length === 0 && (
            <div className="text-center py-12 text-gray-400">해당 조건의 팀이 없습니다.</div>
          )}

          {/* 카테고리별 요약 */}
          <div className="mt-8 bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">카테고리별 배치 현황</h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {(Object.entries(CATEGORY_LABELS) as [TeamCategory, typeof CATEGORY_LABELS[TeamCategory]][]).map(
                ([cat, info]) => {
                  const teams = TEAM_CATALOG.filter((t) => t.category === cat);
                  const agents = teams.reduce((sum, t) => sum + t.agents, 0);
                  const active = teams.filter((t) => t.status === "active").length;

                  return (
                    <div key={cat} className={`rounded-lg border p-3 ${info.bg}`}>
                      <div className={`text-xs font-semibold ${info.color} mb-1`}>{info.label}</div>
                      <div className="text-lg font-bold text-gray-900">{teams.length}팀</div>
                      <div className="text-xs text-gray-500">
                        {agents}명 에이전트 · {active}팀 활성
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ 미션 보드 ═══ */}
      {tab === "missions" && (
        <div>
          {/* 미션 통계 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
            {[
              { label: "전체 미션", value: missionStats.total, color: "text-gray-900" },
              { label: "승인 대기", value: missionStats.pending_approval, color: "text-orange-600" },
              { label: "승인됨", value: missionStats.approved, color: "text-blue-600" },
              { label: "진행중", value: missionStats.in_progress, color: "text-purple-600" },
              { label: "완료", value: missionStats.completed, color: "text-green-600" },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3">
                <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 미션 필터 */}
          <div className="flex gap-1 mb-4">
            {[
              { key: "all", label: "전체" },
              { key: "pending", label: "승인 대기" },
              { key: "approved", label: "승인됨" },
              { key: "rejected", label: "반려" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setMissionFilter(f.key)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  missionFilter === f.key
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : missions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <div>미션이 없습니다. 주간 회의를 먼저 실행해주세요.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {missions
                .filter((m) => missionFilter === "all" || m.approval_status === missionFilter)
                .map((mission) => {
                  const priorityColors: Record<string, string> = {
                    critical: "border-l-red-500 bg-red-50",
                    high: "border-l-orange-400",
                    medium: "border-l-blue-400",
                    low: "border-l-gray-300",
                  };
                  const priorityLabels: Record<string, string> = {
                    critical: "긴급", high: "높음", medium: "보통", low: "낮음",
                  };
                  const approvalColors: Record<string, string> = {
                    pending: "bg-orange-100 text-orange-700",
                    approved: "bg-green-100 text-green-700",
                    rejected: "bg-red-100 text-red-700",
                    deferred: "bg-gray-100 text-gray-600",
                  };
                  const isExpanded = expandedMission === mission.id;

                  return (
                    <div
                      key={mission.id}
                      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${priorityColors[mission.priority] || ""}`}
                    >
                      <button
                        onClick={() => setExpandedMission(isExpanded ? null : mission.id)}
                        className="w-full text-left px-5 py-4 flex items-center gap-4"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-gray-500">{mission.chief}</span>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-500">{mission.team_name}</span>
                          </div>
                          <h4 className="text-sm font-semibold text-gray-900 truncate">{mission.title}</h4>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${approvalColors[mission.approval_status] || ""}`}>
                          {mission.approval_status === "pending" ? "대기" :
                           mission.approval_status === "approved" ? "승인" :
                           mission.approval_status === "rejected" ? "반려" : "보류"}
                        </span>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {priorityLabels[mission.priority] || mission.priority}
                        </span>
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                          {mission.description && (
                            <p className="text-xs text-gray-600">{mission.description}</p>
                          )}
                          {mission.expected_outcome && (
                            <div>
                              <span className="text-xs font-medium text-gray-500">기대 성과: </span>
                              <span className="text-xs text-gray-700">{mission.expected_outcome}</span>
                            </div>
                          )}
                          {mission.due_date && (
                            <div className="text-xs text-gray-500">마감일: {mission.due_date}</div>
                          )}
                          {mission.rejection_reason && (
                            <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">반려 사유: {mission.rejection_reason}</div>
                          )}

                          {/* 승인/반려 버튼 */}
                          {mission.approval_status === "pending" && (
                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch(`/api/admin/agents/missions/${mission.id}/approve`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "approve" }),
                                  });
                                  fetchMissions();
                                }}
                                className="text-xs px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                              >
                                ✓ 승인
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  const reason = prompt("반려 사유를 입력하세요:");
                                  if (reason === null) return;
                                  await fetch(`/api/admin/agents/missions/${mission.id}/approve`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "reject", reason }),
                                  });
                                  fetchMissions();
                                }}
                                className="text-xs px-4 py-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                              >
                                ✕ 반려
                              </button>
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await fetch(`/api/admin/agents/missions/${mission.id}/approve`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ action: "defer" }),
                                  });
                                  fetchMissions();
                                }}
                                className="text-xs px-4 py-1.5 bg-gray-50 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                              >
                                보류
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ═══ 주간 회의 ═══ */}
      {tab === "meetings" && (
        <div>
          {/* 트리거 버튼 */}
          <div className="flex gap-3 mb-5">
            <button
              onClick={async () => {
                if (triggeringMeeting) return;
                setTriggeringMeeting(true);
                try {
                  await fetch("/api/admin/agents/meeting", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "weekly" }),
                  });
                  fetchMeetings();
                } catch {}
                setTriggeringMeeting(false);
              }}
              disabled={triggeringMeeting}
              className="text-sm px-5 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {triggeringMeeting ? "⏳ 실행 중..." : "🚀 주간 회의 시작"}
            </button>
            <button
              onClick={async () => {
                if (triggeringMeeting) return;
                setTriggeringMeeting(true);
                try {
                  await fetch("/api/admin/agents/meeting", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ type: "monthly" }),
                  });
                  fetchMeetings();
                } catch {}
                setTriggeringMeeting(false);
              }}
              disabled={triggeringMeeting}
              className="text-sm px-5 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              📊 월간 리뷰 시작
            </button>
          </div>

          {/* KPI 미니 대시보드 */}
          {kpi && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              {[
                { label: "총 사용자", value: kpi.users.total, sub: `+${kpi.users.new_this_week} 이번 주` },
                { label: "사업계획서", value: kpi.plans.total, sub: `+${kpi.plans.this_week} 이번 주` },
                { label: "구독자", value: kpi.subscriptions.active, sub: `Pro ${kpi.subscriptions.pro}` },
                { label: "AI 비용 (주)", value: `$${kpi.ai.weekly_cost}`, sub: `plan당 $${kpi.ai.cost_per_plan}` },
                { label: "지원사업", value: kpi.programs.total, sub: "매칭 대상" },
                { label: "최근 미션", value: kpi.meetings.missions.total, sub: `대기 ${kpi.meetings.missions.pending}` },
              ].map((item) => (
                <div key={item.label} className="bg-white rounded-xl border border-gray-200 p-3">
                  <div className="text-lg font-bold text-gray-900">{item.value}</div>
                  <div className="text-xs text-gray-500">{item.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">{item.sub}</div>
                </div>
              ))}
            </div>
          )}

          {/* 회의 히스토리 */}
          <h3 className="text-sm font-semibold text-gray-900 mb-3">회의 히스토리</h3>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : meetings.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-3">📅</div>
              <div>아직 회의 기록이 없습니다. 위 버튼으로 첫 회의를 시작하세요.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {meetings.map((meeting) => {
                const statusColors: Record<string, string> = {
                  pending: "bg-gray-100 text-gray-600",
                  collecting_metrics: "bg-yellow-100 text-yellow-700",
                  strategy_meeting: "bg-blue-100 text-blue-700",
                  team_analysis: "bg-purple-100 text-purple-700",
                  uploading_notion: "bg-indigo-100 text-indigo-700",
                  completed: "bg-green-100 text-green-700",
                  failed: "bg-red-100 text-red-700",
                };
                const statusLabels: Record<string, string> = {
                  pending: "대기",
                  collecting_metrics: "지표 수집",
                  strategy_meeting: "전략 회의",
                  team_analysis: "팀 분석",
                  uploading_notion: "노션 업로드",
                  completed: "완료",
                  failed: "실패",
                };
                const isExpanded = expandedMeeting === meeting.id;

                return (
                  <div key={meeting.id} className="bg-white rounded-xl border border-gray-200">
                    <button
                      onClick={() => setExpandedMeeting(isExpanded ? null : meeting.id)}
                      className="w-full text-left px-5 py-4 flex items-center gap-4"
                    >
                      <div className="flex-shrink-0 text-center">
                        <div className="text-xs font-bold text-gray-400">
                          {meeting.meeting_type === "weekly" ? "주간" : "월간"}
                        </div>
                        <div className="text-sm font-bold text-gray-900">{meeting.meeting_date}</div>
                        {meeting.week_number && (
                          <div className="text-[10px] text-gray-400">W{meeting.week_number}</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        {meeting.current_phase && meeting.status !== "completed" && meeting.status !== "failed" && (
                          <div className="text-xs text-blue-600 mb-0.5">{meeting.current_phase}</div>
                        )}
                        {meeting.strategy_summary && (
                          <p className="text-xs text-gray-500 truncate">{meeting.strategy_summary.slice(0, 100)}...</p>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${statusColors[meeting.status] || ""}`}>
                        {statusLabels[meeting.status] || meeting.status}
                      </span>
                      {meeting.duration_ms && (
                        <span className="text-xs text-gray-400 flex-shrink-0">
                          {Math.round(meeting.duration_ms / 1000)}s
                        </span>
                      )}
                      <svg
                        className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                        fill="none" viewBox="0 0 24 24" stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-3">
                        {meeting.strategy_summary && (
                          <div>
                            <div className="text-xs font-medium text-gray-600 mb-1">전략 요약</div>
                            <div className="text-xs text-gray-700 whitespace-pre-line bg-gray-50 rounded-lg p-3">
                              {meeting.strategy_summary}
                            </div>
                          </div>
                        )}
                        <div className="flex gap-4 text-xs text-gray-500">
                          <span>토큰: {meeting.total_tokens?.toLocaleString()}</span>
                          <span>비용: ${meeting.total_cost_usd?.toFixed(4)}</span>
                          <span>트리거: {meeting.triggered_by}</span>
                        </div>
                        {meeting.notion_page_url && (
                          <a
                            href={meeting.notion_page_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                          >
                            📝 노션 보고서 보기 →
                          </a>
                        )}
                        {meeting.error_message && (
                          <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                            에러: {meeting.error_message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ 선정 패턴 ═══ */}
      {tab === "patterns" && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : patterns.length === 0 ? (
            <div className="text-center py-8 text-gray-400">패턴 데이터 없음 (시딩 필요)</div>
          ) : (
            <div className="space-y-4">
              {patterns.map((p) => (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{p.title}</h3>
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">
                        {p.weight}점
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {p.category} / {p.subcategory}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3">{p.description}</p>
                  {p.good_examples && p.good_examples.length > 0 && (
                    <div className="mb-2">
                      <div className="text-xs font-medium text-green-700 mb-1">Good:</div>
                      {p.good_examples.slice(0, 2).map((ex, i) => (
                        <div
                          key={i}
                          className="text-xs text-green-600 bg-green-50 rounded px-2 py-1 mb-1 truncate"
                        >
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}
                  {p.bad_examples && p.bad_examples.length > 0 && (
                    <div>
                      <div className="text-xs font-medium text-red-700 mb-1">Bad:</div>
                      {p.bad_examples.slice(0, 2).map((ex, i) => (
                        <div
                          key={i}
                          className="text-xs text-red-600 bg-red-50 rounded px-2 py-1 mb-1 truncate"
                        >
                          {ex}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ 실행 로그 ═══ */}
      {tab === "logs" && (
        <div>
          {loading ? (
            <div className="text-center py-8 text-gray-400">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400">실행 로그 없음</div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-medium text-gray-600">스킬</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">토큰</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">비용</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">시간</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100">
                      <td className="px-4 py-3 font-mono text-xs">{log.skill_name}</td>
                      <td className="px-4 py-3 text-xs">{log.action}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            log.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : log.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-yellow-100 text-yellow-700"
                          }`}
                        >
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {(log.input_tokens + log.output_tokens).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        ${log.cost_usd?.toFixed(4) || "0"}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {new Date(log.created_at).toLocaleString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
