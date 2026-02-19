/**
 * Agent Meeting → Notion Integration
 *
 * Notion API를 직접 호출하여 회의 보고서 페이지 + 미션 보드 항목 생성
 *
 * 구조:
 * BizPlan AI - 프로젝트 허브
 *   └── Agent Team Operations (307b350c-094c-810c-a41c-c1c778fb9bfb)
 *       ├── Mission Board DB (84a911c8-39e5-4be1-a71c-a3bfa0f0d5bb)
 *       └── 2026-W08 주간 회의 (날짜별 자동 생성)
 */

import type { TeamAnalysisOutput, ServiceMetrics } from './meeting-types';

// ─── 노션 설정 ─────────────────────────────────────────────────
const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const NOTION_VERSION = '2022-06-28';

// Agent Team Operations 페이지 ID (노션에 이미 생성됨)
const OPERATIONS_PAGE_ID = '307b350c-094c-810c-a41c-c1c778fb9bfb';

// Mission Board 데이터베이스 ID
const MISSION_BOARD_DB_ID = '7bba4b3e-d6e1-4567-941a-e710a8656469';

// 팀 ID → 노션 셀렉트 이름 매핑
const TEAM_SELECT_MAP: Record<string, string> = {
  '02-marketing': '02-마케팅',
  '05-ecommerce': '05-커머스',
  '09-bizdev': '09-사업개발',
  '13-data': '13-데이터',
};

// ─── 메인 업로드 함수 ───────────────────────────────────────────

interface NotionUploadResult {
  url: string;
  pageId: string;
  missionCount: number;
}

interface MissionForNotion {
  team_id: string;
  team_name: string;
  chief: string;
  title: string;
  description?: string;
  category: string;
  priority: string;
  expected_outcome?: string;
  due_date?: string;
}

/**
 * 노션에 회의 보고서 + 미션 업로드
 */
export async function uploadMeetingToNotion(
  meetingType: 'weekly' | 'monthly',
  meetingDate: string,
  weekNumber: number | undefined,
  metrics: ServiceMetrics,
  strategySummary: string,
  teamReports: Array<{
    team_id: string;
    team_name: string;
    chief: string;
    analysis_summary: string;
    key_findings: string[];
    action_items: Array<{
      title: string;
      priority: string;
      expected_outcome: string;
      description?: string;
      category?: string;
      due_date?: string;
    }>;
  }>,
  totalTokens: number,
  totalCost: number,
): Promise<NotionUploadResult | null> {
  if (!NOTION_API_KEY) {
    console.warn('[Meeting Notion] NOTION_API_KEY not set, skipping upload');
    return null;
  }

  try {
    // 1. 회의 보고서 페이지 생성
    const title = meetingType === 'weekly'
      ? `${meetingDate.substring(0, 4)}-W${String(weekNumber || '??').padStart(2, '0')} 주간 회의 (${meetingDate})`
      : `${meetingDate.substring(0, 7)} 월간 리뷰 (${meetingDate})`;

    const reportBlocks = buildReportBlocks(
      meetingType, meetingDate, weekNumber, metrics,
      strategySummary, teamReports, totalTokens, totalCost
    );

    const reportPage = await notionCreatePage(OPERATIONS_PAGE_ID, title, reportBlocks);
    if (!reportPage) {
      console.error('[Meeting Notion] Failed to create report page');
      return null;
    }

    console.log(`[Meeting Notion] Report page created: ${reportPage.url}`);

    // 2. 미션 보드에 미션 아이템 추가
    const allMissions: MissionForNotion[] = teamReports.flatMap((r) =>
      (r.action_items || []).map((a) => ({
        team_id: r.team_id,
        team_name: r.team_name,
        chief: r.chief,
        title: a.title,
        description: a.description,
        category: a.category || 'ops',
        priority: a.priority || 'medium',
        expected_outcome: a.expected_outcome,
        due_date: a.due_date,
      }))
    );

    let missionCount = 0;
    for (const mission of allMissions) {
      try {
        await createMissionInNotion(mission, meetingDate, weekNumber);
        missionCount++;
      } catch (err) {
        console.warn(`[Meeting Notion] Failed to create mission: ${mission.title}`, err);
      }
    }

    console.log(`[Meeting Notion] ${missionCount}/${allMissions.length} missions created in Mission Board`);

    return {
      url: reportPage.url,
      pageId: reportPage.id,
      missionCount,
    };
  } catch (error) {
    console.error('[Meeting Notion] Upload failed:', error);
    return null;
  }
}

// ─── 노션 API 헬퍼 ─────────────────────────────────────────────

async function notionFetch(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${NOTION_API_KEY}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Notion API error ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function notionCreatePage(
  parentPageId: string,
  title: string,
  children: unknown[],
): Promise<{ id: string; url: string } | null> {
  const result = await notionFetch('/pages', {
    parent: { page_id: parentPageId },
    properties: {
      title: {
        title: [{ text: { content: title } }],
      },
    },
    children: children.slice(0, 100), // Notion API 최대 100블록
  }) as { id: string; url: string };

  return result;
}

async function createMissionInNotion(
  mission: MissionForNotion,
  meetingDate: string,
  weekNumber: number | undefined,
): Promise<void> {
  const teamSelect = TEAM_SELECT_MAP[mission.team_id] || mission.team_name;
  const meetingLabel = `W${String(weekNumber || '??').padStart(2, '0')} (${meetingDate})`;

  const properties: Record<string, unknown> = {
    'Name': {
      title: [{ text: { content: mission.title } }],
    },
    'Team': {
      select: { name: teamSelect },
    },
    'Priority': {
      select: { name: mission.priority },
    },
    'Category': {
      select: { name: mission.category },
    },
    'Chief': {
      rich_text: [{ text: { content: mission.chief } }],
    },
    'Approval': {
      select: { name: 'pending' },
    },
    'Execution': {
      select: { name: 'waiting' },
    },
    'Meeting': {
      rich_text: [{ text: { content: meetingLabel } }],
    },
    'Expected Outcome': {
      rich_text: [{ text: { content: (mission.expected_outcome || '').substring(0, 2000) } }],
    },
  };

  if (mission.due_date) {
    properties['Due Date'] = {
      date: { start: mission.due_date },
    };
  }

  await notionFetch('/pages', {
    parent: { database_id: MISSION_BOARD_DB_ID },
    properties,
  });
}

// ─── 보고서 블록 생성 ───────────────────────────────────────────

function buildReportBlocks(
  meetingType: 'weekly' | 'monthly',
  meetingDate: string,
  weekNumber: number | undefined,
  metrics: ServiceMetrics,
  strategySummary: string,
  teamReports: Array<{
    team_id: string;
    team_name: string;
    chief: string;
    analysis_summary: string;
    key_findings: string[];
    action_items: Array<{
      title: string;
      priority: string;
      expected_outcome: string;
    }>;
  }>,
  totalTokens: number,
  totalCost: number,
): unknown[] {
  const blocks: unknown[] = [];

  // 회의 개요
  blocks.push(heading2('회의 개요'));
  blocks.push(paragraph(
    `**유형:** ${meetingType === 'weekly' ? '주간 회의' : '월간 리뷰'} | ` +
    `**날짜:** ${meetingDate} (W${weekNumber || '??'}) | ` +
    `**토큰:** ${totalTokens.toLocaleString()} | ` +
    `**비용:** $${totalCost.toFixed(4)}`
  ));
  blocks.push(divider());

  // 서비스 지표
  blocks.push(heading2('서비스 지표 스냅샷'));
  blocks.push(paragraph(
    `사용자: ${metrics.users?.total || 0}명 (신규 ${metrics.users?.new_this_week || 0}명) | ` +
    `DAU: ${metrics.users?.dau_avg || 0} | ` +
    `리텐션 7일: ${metrics.users?.retention_7d || 0}%`
  ));
  blocks.push(paragraph(
    `사업계획서: ${metrics.plans?.total || 0}건 (금주 ${metrics.plans?.this_week || 0}건) | ` +
    `매칭 프로그램: ${metrics.programs?.total_active || 0}건 (매칭 ${metrics.programs?.total_matchings || 0}건) | ` +
    `MRR: ₩${(metrics.subscriptions?.mrr || 0).toLocaleString()}`
  ));
  blocks.push(divider());

  // CSO 전략 요약
  blocks.push(heading2('CSO 전략 회의 요약'));
  const strategyLines = strategySummary.split('\n').filter(Boolean);
  for (const line of strategyLines.slice(0, 20)) {
    blocks.push(paragraph(line));
  }
  blocks.push(divider());

  // 팀별 분석
  blocks.push(heading2('팀별 분석 및 미션'));

  for (const report of teamReports) {
    blocks.push(heading3(`${report.team_name} (${report.chief})`));

    if (report.key_findings?.length) {
      blocks.push(paragraph('**핵심 발견:**'));
      for (const finding of report.key_findings.slice(0, 5)) {
        blocks.push(bulletItem(finding));
      }
    }

    if (report.action_items?.length) {
      blocks.push(paragraph('**실행 미션:**'));
      for (const item of report.action_items) {
        const priorityEmoji = item.priority === 'critical' ? '🔴' : item.priority === 'high' ? '🟡' : '🔵';
        blocks.push(bulletItem(
          `${priorityEmoji} [${item.priority}] ${item.title}`
        ));
      }
    }
  }

  return blocks;
}

// ─── 노션 블록 헬퍼 ─────────────────────────────────────────────

function heading2(text: string): unknown {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function heading3(text: string): unknown {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function paragraph(text: string): unknown {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function bulletItem(text: string): unknown {
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: {
      rich_text: [{ type: 'text', text: { content: text } }],
    },
  };
}

function divider(): unknown {
  return {
    object: 'block',
    type: 'divider',
    divider: {},
  };
}
