import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { callClaudeAPI as callClaude } from "@/lib/ai/claude";

export const maxDuration = 60;

/**
 * 사업계획서 ↔ 공고 매칭 점수 평가 프롬프트
 * 3차원 평가: 구조일치(40) + 내용충족(40) + 경쟁력(20) = 100점
 */
const PLAN_EVALUATION_PROMPT = `당신은 정부지원사업 평가위원 경력 10년 이상의 전문가입니다.
아래 사업계획서가 공고 지침서 요구사항에 얼마나 부합하는지 평가하세요.

## 평가 기준 (총 100점)

### 1. 구조 일치도 (40점)
- 공고에서 요구하는 섹션이 모두 포함되어 있는가?
- 섹션 순서가 공고 양식과 일치하는가?
- 필수 포함 내용이 모두 작성되어 있는가?
- 누락된 섹션이나 필수 항목이 있는가?

### 2. 내용 충족도 (40점)
- 각 섹션의 내용이 공고의 작성 지침에 부합하는가?
- 평가 기준에서 요구하는 내용이 충분히 기술되어 있는가?
- 수치/데이터가 구체적으로 제시되어 있는가?
- 고용 효과, ESG, 사회적 가치 등 가산점 항목이 반영되어 있는가?

### 3. 경쟁력 (20점)
- 차별화 요소가 명확하게 드러나는가?
- 기술/시장/팀 역량이 설득력 있게 기술되어 있는가?
- 실현 가능성이 높은 목표가 제시되어 있는가?
- 평가위원 관점에서 선정하고 싶은 수준인가?

## 출력 형식 (JSON)

\`\`\`json
{
  "total_score": 0,
  "grade": "S|A|B|C|D",
  "submission_ready": true,
  "scores": {
    "structure_match": {
      "score": 0,
      "max": 40,
      "details": "평가 상세 내용",
      "missing_sections": ["누락된 섹션"],
      "improvements": ["개선 제안"]
    },
    "content_fulfillment": {
      "score": 0,
      "max": 40,
      "details": "평가 상세 내용",
      "weak_sections": ["보완 필요 섹션"],
      "improvements": ["개선 제안"]
    },
    "competitiveness": {
      "score": 0,
      "max": 20,
      "details": "평가 상세 내용",
      "strengths": ["강점"],
      "improvements": ["개선 제안"]
    }
  },
  "section_scores": [
    {
      "section_name": "섹션명",
      "score": 0,
      "max": 10,
      "feedback": "섹션별 피드백"
    }
  ],
  "overall_feedback": "종합 평가 (3-5문장)",
  "top_improvements": ["가장 중요한 개선사항 Top 3"],
  "estimated_pass_rate": "상/중/하 — 현재 수준에서의 선정 가능성"
}
\`\`\`

## 평가 원칙
1. 공고 지침서의 평가 기준을 정확히 대입하여 평가
2. 수치가 "[입력 필요]"나 "미확인"인 부분은 감점
3. 총점 85+ = S등급(제출 가능), 70-84 = A등급(소폭 보완), 55-69 = B등급(보완 필요), 40-54 = C등급(대폭 보완), 0-39 = D등급(재작성)
4. submission_ready = total_score >= 70

JSON만 출력하세요.`;

/**
 * POST /api/plans/[id]/evaluate
 * 사업계획서 ↔ 공고 매칭 점수 평가
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const adminClient = createAdminClient();

  // 1. 사업계획서 정보 + 섹션 내용 로드
  const { data: plan } = await adminClient
    .from("business_plans")
    .select("*, programs(id, title, raw_data, attachment_urls)")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "사업계획서를 찾을 수 없습니다" }, { status: 404 });
  }

  if (plan.status !== "completed") {
    return NextResponse.json({ error: "완성된 사업계획서만 평가 가능합니다" }, { status: 400 });
  }

  // 2. 섹션 내용 로드
  const { data: sections } = await adminClient
    .from("plan_sections")
    .select("section_order, section_name, content, guidelines, evaluation_weight")
    .eq("plan_id", planId)
    .order("section_order");

  if (!sections || sections.length === 0) {
    return NextResponse.json({ error: "섹션 내용이 없습니다" }, { status: 400 });
  }

  // 3. 공고 지침서 구조 가져오기 (있으면)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = (plan as { programs?: Record<string, any> | null }).programs;
  let guidelineContext = "";

  if (program?.raw_data?.guideline_structure) {
    const gs = program.raw_data.guideline_structure;
    guidelineContext = `\n## 공고 지침서 구조\n공고명: ${program.title}\n프로그램 유형: ${gs.program_type || "미분류"}\n제출 형식: ${gs.submission_format || "미지정"}\n\n### 요구 섹션:\n`;

    for (const sec of gs.sections || []) {
      guidelineContext += `${sec.order}. ${sec.name} (배점: ${sec.evaluation_weight || 0}점)\n`;
      if (sec.guidelines) guidelineContext += `   지침: ${sec.guidelines}\n`;
      if (sec.required_contents?.length > 0) {
        guidelineContext += `   필수 내용: ${sec.required_contents.join(", ")}\n`;
      }
    }

    if (gs.evaluation_table?.length > 0) {
      guidelineContext += `\n### 평가 기준표:\n`;
      for (const cat of gs.evaluation_table) {
        guidelineContext += `[${cat.category}]\n`;
        for (const item of cat.items) {
          guidelineContext += `  - ${item.item}: ${item.weight}점 — ${item.description || ""}\n`;
        }
      }
    }

    if (gs.key_requirements?.length > 0) {
      guidelineContext += `\n### 핵심 요구사항:\n${gs.key_requirements.map((r: string) => `- ${r}`).join("\n")}`;
    }

    if (gs.bonus_criteria?.length > 0) {
      guidelineContext += `\n### 가산점 항목:\n${gs.bonus_criteria.map((b: string) => `- ${b}`).join("\n")}`;
    }
  } else if (program) {
    // 지침서 구조가 없어도 기본 공고 정보로 평가
    guidelineContext = `\n## 공고 정보 (지침서 미추출)\n공고명: ${program.title}\n`;
  }

  // 4. 사업계획서 내용 구성
  let planContent = `## 사업계획서: ${plan.title}\n\n`;
  for (const sec of sections) {
    planContent += `### ${sec.section_order}. ${sec.section_name}\n`;
    if (sec.guidelines) planContent += `[작성 지침: ${sec.guidelines}]\n`;
    planContent += `${sec.content || "[내용 없음]"}\n\n`;
  }

  // 5. Claude 평가 실행
  try {
    const evaluationJson = await callClaude({
      model: "claude-sonnet-4-20250514",
      system: PLAN_EVALUATION_PROMPT,
      messages: [{
        role: "user",
        content: `${guidelineContext}\n\n---\n\n${planContent}`,
      }],
      temperature: 0.2,
      maxTokens: 4000,
    });

    // JSON 파싱
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let evaluation: Record<string, any> | null = null;
    try {
      const jsonMatch = evaluationJson.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        evaluation = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("[PlanEval] JSON 파싱 실패:", parseError);
      return NextResponse.json({ error: "평가 결과 파싱 실패" }, { status: 500 });
    }

    if (!evaluation) {
      return NextResponse.json({ error: "평가 결과를 생성하지 못했습니다" }, { status: 500 });
    }

    // 6. DB에 평가 결과 저장 (evaluation_criteria JSONB에 추가)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existingCriteria = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria || {};
    const updatedCriteria = {
      ...existingCriteria,
      plan_evaluation: evaluation,
      evaluated_at: new Date().toISOString(),
      has_guideline: !!program?.raw_data?.guideline_structure,
    };

    await adminClient
      .from("business_plans")
      .update({ evaluation_criteria: updatedCriteria })
      .eq("id", planId);

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error("[PlanEval] 평가 오류:", error);
    return NextResponse.json({
      error: "평가 중 오류가 발생했습니다",
      detail: String(error),
    }, { status: 500 });
  }
}

/**
 * GET /api/plans/[id]/evaluate
 * 이미 수행된 평가 결과 조회
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;

  const { data: plan } = await supabase
    .from("business_plans")
    .select("evaluation_criteria")
    .eq("id", planId)
    .single();

  if (!plan) {
    return NextResponse.json({ error: "사업계획서를 찾을 수 없습니다" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const evalCriteria = (plan as { evaluation_criteria?: Record<string, any> }).evaluation_criteria;
  const evaluation = evalCriteria?.plan_evaluation;

  if (!evaluation) {
    return NextResponse.json({
      evaluated: false,
      message: "아직 평가가 수행되지 않았습니다. POST로 평가해주세요.",
    });
  }

  return NextResponse.json({
    evaluated: true,
    evaluation,
    evaluated_at: evalCriteria?.evaluated_at,
  });
}
