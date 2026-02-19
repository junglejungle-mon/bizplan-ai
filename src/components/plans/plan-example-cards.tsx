"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText,
  ArrowLeft,
  Sparkles,
} from "lucide-react";
import { SectionContent } from "./section-content";

/**
 * 사업계획서 예시 카드 3개
 * 클릭하면 실제 /plans/[id] 페이지와 동일한 레이아웃으로 내용 표시
 */

const EXAMPLE_PLANS = [
  {
    title: "2025년 반려동물 헬스케어 수출바우처 사업계획서",
    institution: "중소벤처기업부 / KOTRA",
    score: "A+",
    color: "green" as const,
    sections: [
      {
        name: "사업 개요",
        content:
          "본 사업은 반려동물 구강케어 전문기업으로서, 독자 개발한 천연 효소 기반 **'덴티소프트'** 제품의 해외 시장 진출을 목표로 합니다.\n\n국내 반려동물 시장이 연 10% 이상 성장하는 가운데, 글로벌 펫케어 시장은 2025년 기준 약 **380조원** 규모로 확대될 전망입니다. 당사는 수출바우처를 활용하여 일본·동남아 시장을 우선 공략하고, **3년 내 해외 매출 비중 40%**를 달성하고자 합니다.\n\n### 핵심 추진 목표\n- 일본·태국·베트남 3개국 동시 진출\n- 해외 매출 1차년도 6억원, 3차년도 35억원 달성\n- K-펫케어 브랜드 글로벌 인지도 확보",
      },
      {
        name: "문제 인식 및 필요성",
        content:
          "반려동물 구강 질환은 3세 이상 반려견의 **80%**가 겪는 가장 흔한 건강 문제입니다.\n\n기존 구강케어 제품들은 화학 성분 기반으로 반려동물에게 부담이 되며, 보호자들의 불안감이 높은 상황입니다. 특히 해외 시장에서는 **'천연·유기농' 펫 제품 수요가 연 25% 증가**하고 있으나, 효과가 검증된 천연 구강케어 솔루션은 극히 부족합니다.\n\n| 구분 | 기존 제품 | 당사 제품 |\n|------|-----------|----------|\n| 성분 | 화학 합성 | 천연 효소 |\n| 치석 제거율 | 45% | 73% |\n| 부작용 | 위장장애 우려 | 없음 |\n| 가격대 | 2~3만원 | 2.5만원 |",
      },
      {
        name: "제품·서비스 내용",
        content:
          "**덴티소프트**는 천연 효소(락토페린·리소자임) 기반 반려동물 구강케어 제품으로, 칫솔질 없이도 치석 제거와 구취 개선이 가능합니다.\n\n- **특허 기술**: 제10-2024-XXXXX호 보유\n- **임상 검증**: 국내 동물병원 150곳에서 12주간 시험 완료\n  - 치석 감소율 **73%**\n  - 구취 개선율 **89%**\n\n### 제품 라인업\n1. **구강 스프레이** — 간편 사용, 즉각적 구취 개선\n2. **덴탈 츄** — 씹는 과정에서 치석 물리적 제거\n3. **음수 첨가제** — 매일 음수에 섞어 지속적 구강 관리",
      },
      {
        name: "시장 분석 (TAM/SAM/SOM)",
        content:
          "### 시장 규모\n\n| 구분 | 규모 | 비고 |\n|------|------|------|\n| **TAM** (글로벌 펫 구강케어) | 12조원 | 연평균 18.2% 성장 |\n| **SAM** (아태 지역) | 3.5조원 | 일본 1.8조, 태국 4천억, 베트남 2.5천억 |\n| **SOM** (초기 진출 시장) | 800억원 | 일본·태국 온라인+동물병원 채널 |\n\n1차년도 시장점유율 **0.5%**(4억원) 목표이며, 3차년도까지 점유율 **2.5%**(20억원)으로 확대합니다.\n\n### 성장 동인\n- 반려동물 고령화 → 구강케어 수요 증가\n- 천연·유기농 제품 프리미엄 트렌드\n- 아시아 펫 시장 연 15% 이상 고성장",
      },
      {
        name: "사업 추진 전략",
        content:
          "### Phase 1 (1~6개월): 일본 시장 진출\n- 현지 유통 파트너 **이온펫**과 MOU 체결\n- 動物用医薬品 인증 취득\n- 아마존재팬 입점 및 온라인 마케팅\n\n### Phase 2 (7~12개월): 동남아 확장\n- **Shopee/Lazada** 입점 (태국·베트남)\n- 현지 동물병원 20곳 납품 계약\n- SNS 인플루언서 마케팅 실행 (반려동물 유튜버 10명)\n\n### Phase 3 (13~18개월): 미국 시장 테스트\n- Amazon US 입점\n- FDA 등록 준비\n- 미국 펫 전시회 **SuperZoo** 참가",
      },
      {
        name: "실현 가능성",
        content:
          "당사는 국내 매출 **30억원**을 달성한 검증된 기업으로, 쿠팡·네이버 펫 카테고리 구강케어 부문 **1위**를 유지하고 있습니다.\n\n### 핵심 역량\n- **대표이사**: 수의학 박사, 동물 헬스케어 15년 경력\n- **해외영업 이사**: 일본·동남아 소비재 수출 10년 경험\n- **기술**: 특허 2건, 실용신안 1건 확보\n- **생산**: 자체 GMP 공장 보유 (월 생산능력 10만개)\n\n### 재무 안정성\n- 부채비율 35%, 영업이익률 18%\n- 3년 연속 흑자 경영",
      },
      {
        name: "사업화 계획",
        content:
          "| 연차 | 지역 | 해외 매출 목표 | 전체 매출 대비 |\n|------|------|---------------|---------------|\n| 1차년도 | 일본·태국 | 6억원 | 15% |\n| 2차년도 | +베트남 | 15억원 | 30% |\n| 3차년도 | +미국 | 35억원 | 40% |\n\n### 수출바우처 자금 배분\n- 해외 인증비: **40%** (1,200만원)\n- 마케팅: **35%** (1,050만원)\n- 전시회 참가: **25%** (750만원)",
      },
      {
        name: "기대 효과",
        content:
          "### 정량적 효과\n- 3년간 신규 해외 고용 **5명** 창출\n- 해외 매출 누적 **56억원** 달성\n- 글로벌 유통 네트워크 **3개국** 확보\n\n### 정성적 효과\n- K-펫케어 브랜드의 해외 인지도 제고\n- 국내 반려동물 산업의 글로벌 경쟁력 강화\n- 천연 펫케어 시장 선도 기업으로서의 포지셔닝 확보",
      },
    ],
  },
  {
    title: "AI 기반 ESG 리포트 자동화 플랫폼 사업계획서",
    institution: "창업진흥원 / 예비창업패키지",
    score: "A",
    color: "blue" as const,
    sections: [
      {
        name: "사업 개요",
        content:
          "본 사업은 AI 자연어처리 기술을 활용하여 중소·중견기업의 **ESG 보고서 작성을 자동화**하는 SaaS 플랫폼을 개발·운영합니다.\n\n2025년부터 자산 2조원 이상 기업의 ESG 공시가 의무화되며, 향후 전 상장사로 확대될 예정입니다. 당사 플랫폼은 기존 **수천만원의 컨설팅 비용을 월 50만원 구독료**로 대체합니다.\n\n### 핵심 가치\n- 비용 90% 절감 (컨설팅 3,000만원 → 연 600만원)\n- 작성 기간 80% 단축 (6개월 → 1개월)\n- GRI/SASB/TCFD 프레임워크 자동 준수",
      },
      {
        name: "문제 인식 및 필요성",
        content:
          "ESG 보고서 작성에는 평균 **3~6개월**, 비용 **3,000만~1억원**이 소요됩니다.\n\n중소기업은 전문인력 부재로 ESG 대응이 사실상 불가능한 상황입니다. 특히 대기업 납품 중소기업은 **'공급망 ESG 평가'**를 통과해야 거래를 유지할 수 있어, 저비용·고효율 ESG 솔루션에 대한 수요가 급증하고 있습니다.\n\n| 구분 | 대기업 | 중소기업 |\n|------|--------|----------|\n| ESG 전담인력 | 평균 5명 | 0명 |\n| 보고서 비용 | 1억원+ | 예산 없음 |\n| 공급망 평가 | 실시 주체 | 평가 대상 |",
      },
      {
        name: "핵심 기술",
        content:
          "### 3대 핵심 기술\n\n1. **ESG 데이터 자동 수집 엔진**\n   - ERP·회계 시스템 API 연동\n   - 전기·수도·폐기물 데이터 자동 수집\n\n2. **GPT-4 기반 보고서 자동 생성**\n   - GRI/SASB/TCFD 프레임워크 준수\n   - 한국어 ESG 보고서 1,200건 학습\n   - 업종별 최적화된 보고서 생성\n\n3. **ESG 리스크 조기 경보 대시보드**\n   - 실시간 ESG 리스크 모니터링\n   - 규제 변경 자동 알림\n\n서울대 AI 연구소와 공동 개발한 **ESG 특화 언어모델** 적용",
      },
      {
        name: "시장 분석",
        content:
          "| 구분 | 규모 | 성장률 |\n|------|------|--------|\n| **TAM** (ESG 컨설팅) | 8,000억원 | 연 30%+ |\n| **SAM** (중소·중견 ESG SaaS) | 2,000억원 | 연 45% |\n| **SOM** (1차년도) | 30억원 | 대기업 1차 협력사 500곳 |\n\n2025년 ESG 의무공시 확대에 따라 **중소기업 ESG SaaS 시장은 폭발적 성장**이 예상됩니다.",
      },
      {
        name: "비즈니스 모델",
        content:
          "### 수익 구조\n\n| 플랜 | 월 요금 | 대상 |\n|------|---------|------|\n| Basic | 50만원 | 중소기업 |\n| Pro | 100만원 | 중견기업 |\n| Enterprise | 맞춤 | 대기업 |\n\n### 추가 수익원\n- ESG 인증 대행 수수료: 건당 200만원\n- ESG 데이터 분석 API: 건당 과금\n\n### 핵심 지표 목표\n- 고객 유지율(Retention): **85%** 이상\n- LTV/CAC 비율: **5:1**",
      },
      {
        name: "추진 전략 및 로드맵",
        content:
          "### MVP (6개월)\n- 제조업 특화 ESG 보고서 자동 생성 기능 개발\n- 베타 테스트 기업 **30곳** 확보\n\n### 정식 출시 (12개월)\n- GRI 기준 보고서 + 대시보드 출시\n- 유료 고객 **100곳** 확보\n- 월 매출 5,000만원 달성\n\n### 확장 (18개월)\n- SASB/TCFD 프레임워크 추가\n- 일본·동남아 현지화 버전 출시\n- 시리즈A 투자 유치",
      },
      {
        name: "팀 구성",
        content:
          "### 핵심 팀\n\n| 직책 | 이름 | 주요 경력 |\n|------|------|----------|\n| **CEO** | 김OO | 前 삼성SDS ESG 컨설팅팀 리드, ESG 보고서 50건+ |\n| **CTO** | 이OO | 서울대 AI 석사, NLP 논문 12편, 前 네이버 AI Lab |\n| **COO** | 박OO | 前 대한상공회의소 ESG 평가위원, 중소기업 ESG 컨설팅 7년 |",
      },
      {
        name: "자금 운용 계획",
        content:
          "### 예비창업패키지 지원금 1억원 배분\n\n| 항목 | 비율 | 금액 | 내용 |\n|------|------|------|------|\n| AI 모델 개발 | 40% | 4,000만원 | ESG 특화 LLM 파인튜닝, 데이터 파이프라인 |\n| 플랫폼 개발 | 30% | 3,000만원 | 웹 대시보드, ERP 연동 모듈 |\n| 마케팅 | 20% | 2,000만원 | 베타 고객 확보, ESG 컨퍼런스 참가 |\n| 운영비 | 10% | 1,000만원 | 클라우드 인프라, 사무실 임차 |",
      },
    ],
  },
  {
    title: "친환경 패키징 소재 기술사업화 사업계획서",
    institution: "한국산업기술진흥원 / 기술사업화",
    score: "A+",
    color: "green" as const,
    sections: [
      {
        name: "사업 개요",
        content:
          "본 사업은 **해조류(켈프) 기반 생분해성 패키징 소재**의 상용화를 목표로 합니다.\n\n자체 개발한 해조류 추출 셀룰로오스 필름 기술을 활용하여 기존 플라스틱 포장재를 대체하는 친환경 소재를 양산합니다.\n\n### 핵심 경쟁력\n- 기존 생분해 소재 대비 **강도 2배**\n- 원가 **30% 절감**\n- 기존 설비 호환 가능 (드롭인 대체)\n\n2025년 플라스틱 규제 강화에 따라 글로벌 친환경 패키징 시장이 급성장 중입니다.",
      },
      {
        name: "기술 현황",
        content:
          "### 핵심 기술\n해조류에서 추출한 **나노셀룰로오스**를 활용한 고강도 생분해성 필름 제조 기술\n\n### 지식재산권\n| 구분 | 건수 | 상태 |\n|------|------|------|\n| 국내 특허 | 2건 | 등록 완료 |\n| PCT 국제 특허 | 1건 | 등록 완료 |\n| 기술 성숙도 | TRL 7 | 파일럿 생산 검증 완료 |\n\n### 공동연구\n- **KAIST 소재공학과**와 3년간 공동연구\n- 파일럿 생산라인에서 월 **5톤** 규모 시제품 생산 검증",
      },
      {
        name: "시장 분석",
        content:
          "| 구분 | 규모 | 성장률 |\n|------|------|--------|\n| **TAM** (글로벌 친환경 패키징) | 450조원 | 연 14.5% |\n| **SAM** (식품용 생분해 필름) | 35조원 | 연 20% |\n| **SOM** (국내 식품·화장품 포장재) | 5,000억원 | 연 25% |\n\n2025년 이후 플라스틱 사용 규제가 강화되면서 **대체 소재 수요가 폭발적으로 증가**할 전망입니다.",
      },
      {
        name: "경쟁 분석",
        content:
          "| 경쟁사 | 국가 | 기술 | 투자 | 당사 대비 |\n|--------|------|------|------|----------|\n| Notpla | 영국 | 해조류 코팅제 | 시리즈A $10M | 필름 기술 미보유 |\n| TIPA | 이스라엘 | 퇴비화 포장 | 시리즈C $70M | 원가 높음 |\n| SKC | 한국 | PBAT 기반 | 대기업 | 석유화학 원료 의존 |\n\n### 당사 경쟁우위\n- 해양 원료 기반 **순환경제 모델**\n- 기존 설비 호환 (드롭인 대체 가능)\n- 원가 경쟁력 (기존 대비 **30% 절감**)",
      },
      {
        name: "비즈니스 모델",
        content:
          "### 주요 수익원\n\n1. **B2B 소재 판매**\n   - kg당 12,000원 (기존 플라스틱 대비 1.5배, ESG 프리미엄 반영)\n   - 초기 고객: CJ, 풀무원, 아모레퍼시픽\n\n2. **기술 라이선싱**\n   - 해외 제조사 대상 로열티 3%\n   - 일본·유럽 패키징 기업 타깃",
      },
      {
        name: "사업 추진 전략",
        content:
          "### Phase 1 (6개월): 양산 설비 구축\n- 월 **50톤** 생산 가능 클린룸 설비 설치\n- 식품접촉물질 인증(KC) 취득\n\n### Phase 2 (12개월): 국내 시장 진출\n- 파일럿 고객 **5곳** 납품\n- 월 매출 **2억원** 달성\n\n### Phase 3 (18개월): 해외 확장\n- EU REACH 인증 완료\n- 일본·유럽 유통사 계약 체결",
      },
      {
        name: "자금 운용 계획",
        content:
          "### 기술사업화 지원금 5억원 배분\n\n| 항목 | 비율 | 금액 | 내용 |\n|------|------|------|------|\n| 양산 설비 투자 | 50% | 2.5억원 | 압출기, 코팅기, 품질검사 장비 |\n| 인증·시험 | 20% | 1억원 | KC, EU REACH, FDA 인증 |\n| 인력 채용 | 15% | 7,500만원 | 소재공학 석사 2명, 영업 1명 |\n| 마케팅 | 15% | 7,500만원 | 전시회, 샘플, 기업 IR |",
      },
      {
        name: "기대 효과",
        content:
          "### 정량적 효과\n- 3년 내 매출 **150억원**, 고용 **30명** 창출\n- 연간 플라스틱 사용량 **3,000톤** 대체\n- CO₂ **8,000톤** 감축\n\n### 정성적 효과\n- 해양 바이오매스 활용 산업 생태계 조성\n- **탄소중립 2050** 정책 목표 직접 기여\n- 친환경 패키징 분야 국내 선도 기업 포지셔닝",
      },
    ],
  },
];

export function PlanExampleCards() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // 펼친 상태: 실제 /plans/[id] 페이지와 동일한 레이아웃
  if (expandedIdx !== null) {
    const plan = EXAMPLE_PLANS[expandedIdx];
    return (
      <div className="space-y-6">
        {/* 상단: 뒤로가기 + 제목 (실제 plans/[id] 헤더와 동일) */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setExpandedIdx(null)}
            className="text-gray-400 hover:text-gray-600 shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {plan.title}
              </h1>
              <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                예시
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                완성
              </Badge>
              <span className="text-xs text-gray-500">{plan.institution}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* 좌측: 목차 (실제 plans/[id]와 동일) */}
          <div className="hidden lg:block space-y-2">
            <h3 className="text-sm font-medium text-gray-500 px-3">목차</h3>
            {plan.sections.map((section, i) => (
              <a
                key={i}
                href={`#example-section-${i}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium">
                  {i + 1}
                </span>
                <span className="truncate">{section.name}</span>
              </a>
            ))}
          </div>

          {/* 중앙: 섹션 카드들 (실제 SectionCard와 동일한 모양) */}
          <div className="lg:col-span-2 space-y-6">
            {plan.sections.map((section, i) => (
              <Card key={i} id={`example-section-${i}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm sm:text-base truncate">
                    {i + 1}. {section.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <SectionContent content={section.content} />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 우측: 안내 카드 */}
          <div className="hidden lg:block">
            <div className="sticky top-6 space-y-4">
              <Card className="border-2 border-purple-300 bg-gradient-to-r from-purple-50 to-indigo-50">
                <CardContent className="py-5">
                  <div className="flex flex-col items-center text-center gap-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-purple-100">
                      <Sparkles className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-gray-900">
                        이 예시처럼 자동 생성
                      </h3>
                      <p className="text-xs text-gray-500 mt-1">
                        지원사업을 선택하면 AI가
                        <br />
                        동일한 품질로 작성합니다
                      </p>
                    </div>
                    <a href="/programs" className="w-full">
                      <Button className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold">
                        <Sparkles className="h-4 w-4" /> 내 계획서 만들기
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 접힌 상태: 카드 3개 목록
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h2 className="text-lg font-bold text-gray-900">
          이런 사업계획서가 만들어집니다
        </h2>
        <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-xs">
          AI 자동 작성 예시
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {EXAMPLE_PLANS.map((plan, idx) => (
          <Card
            key={idx}
            className="hover:shadow-md hover:border-purple-300 transition-all cursor-pointer border-purple-200 bg-gradient-to-br from-purple-50/60 to-indigo-50/40 relative overflow-hidden"
            onClick={() => setExpandedIdx(idx)}
          >
            <div className="absolute top-0 right-0 bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
              예시
            </div>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 flex-shrink-0 mt-0.5">
                  <FileText className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                      className={
                        plan.color === "green"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                      }
                    >
                      {plan.score}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {plan.sections.length}개 섹션
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {plan.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {plan.institution}
                  </p>
                </div>
              </div>

              {/* 미리보기 2개 */}
              <div className="mt-3 space-y-1.5">
                {plan.sections.slice(0, 2).map((sec, si) => (
                  <div
                    key={si}
                    className="bg-white/70 rounded px-2.5 py-1.5 border border-purple-100"
                  >
                    <p className="text-[10px] font-medium text-purple-700">
                      {sec.name}
                    </p>
                    <p className="text-[10px] text-gray-500 line-clamp-2">
                      {sec.content.replace(/[#*|\-\n]/g, " ").substring(0, 100)}...
                    </p>
                  </div>
                ))}
                <p className="text-[10px] text-purple-500 text-center pt-1">
                  클릭하여 전체 내용 보기 ({plan.sections.length}개 섹션)
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
