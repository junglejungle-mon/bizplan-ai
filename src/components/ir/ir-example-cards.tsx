"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Presentation,
  ArrowLeft,
  Download,
  Sparkles,
  FileText,
} from "lucide-react";

/**
 * IR PPT 예시 카드 3개
 * 클릭하면 실제 /plans/[id]/ir 페이지와 동일한 슬라이드 목록 표시
 */

const SLIDE_TYPE_LABELS: Record<string, string> = {
  cover: "표지",
  problem: "문제 정의",
  solution: "솔루션",
  market: "시장 규모",
  business_model: "비즈니스 모델",
  traction: "트랙션/성과",
  competition: "경쟁 분석",
  tech: "기술/제품 차별성",
  team: "팀 소개",
  financials: "재무 계획",
  ask: "투자 요청",
  roadmap: "로드맵",
};

interface ExampleSlide {
  slide_type: string;
  title: string;
  headline: string;
  bullets: string[];
}

interface ExampleIR {
  title: string;
  planTitle: string;
  template: string;
  templateLabel: string;
  slideCount: number;
  score: string;
  color: "green" | "blue" | "purple";
  slides: ExampleSlide[];
}

const EXAMPLE_IRS: ExampleIR[] = [
  {
    title: "반려동물 헬스케어 글로벌 진출 IR",
    planTitle: "2025년 반려동물 헬스케어 수출바우처 사업계획서",
    template: "minimal",
    templateLabel: "미니멀",
    slideCount: 11,
    score: "A+",
    color: "green",
    slides: [
      {
        slide_type: "cover",
        title: "반려동물 헬스케어 글로벌 진출",
        headline: "천연 효소 기반 펫 구강케어 No.1 '덴티소프트'",
        bullets: ["시리즈A 투자유치 IR 자료", "2025년 2월"],
      },
      {
        slide_type: "problem",
        title: "반려동물 구강질환 80% — 해결책 부재",
        headline: "3세 이상 반려견 80%가 구강 질환을 겪고 있지만, 효과적인 천연 솔루션이 없습니다",
        bullets: [
          "기존 제품: 화학 성분 기반 → 부작용 우려",
          "보호자 72%: '안전한 구강케어 제품 부족'",
          "글로벌 천연 펫케어 수요 연 25% 증가",
          "해외 시장 진출 기회 확대",
        ],
      },
      {
        slide_type: "solution",
        title: "덴티소프트: 천연 효소 구강케어",
        headline: "특허 받은 천연 효소(락토페린·리소자임) 기반, 칫솔질 없는 구강 관리",
        bullets: [
          "치석 감소율 73%, 구취 개선율 89% (동물병원 150곳 임상)",
          "3종 라인업: 스프레이 / 덴탈 츄 / 음수 첨가제",
          "특허 제10-2024-XXXXX호 보유",
        ],
      },
      {
        slide_type: "market",
        title: "글로벌 펫케어 380조원 시장",
        headline: "TAM 12조원 → SAM 3.5조원 → SOM 800억원",
        bullets: [
          "글로벌 펫 구강케어 시장: 12조원 (연 18.2% 성장)",
          "아태 지역(SAM): 3.5조원 — 일본 1.8조, 태국 4천억",
          "초기 진출(SOM): 800억원 — 1차년도 점유율 0.5%",
        ],
      },
      {
        slide_type: "business_model",
        title: "B2B2C 유통 + D2C 구독 모델",
        headline: "동물병원 B2B + 이커머스 D2C 병행, 구독 모델로 반복 수익 확보",
        bullets: [
          "B2B: 동물병원 납품 (현재 국내 150곳)",
          "D2C: 쿠팡/네이버 + 해외 Amazon/Shopee",
          "구독 모델: 월 정기배송 (재구매율 65%)",
        ],
      },
      {
        slide_type: "traction",
        title: "국내 매출 30억 / 동물병원 150곳",
        headline: "쿠팡·네이버 펫 구강케어 부문 1위, 3년 연속 흑자",
        bullets: [
          "2024년 매출 30억원 달성",
          "동물병원 150곳 납품, 재구매율 65%",
          "네이버·쿠팡 구강케어 카테고리 1위",
          "부채비율 35%, 영업이익률 18%",
        ],
      },
      {
        slide_type: "competition",
        title: "경쟁사 대비 3가지 핵심 차별점",
        headline: "천연 성분 + 임상 검증 + 가격 경쟁력",
        bullets: [
          "vs 기존 화학제품: 천연 효소 기반, 부작용 제로",
          "vs 해외 천연제품: 동물병원 임상 검증 완료",
          "vs 프리미엄 제품: 동등 효과, 가격 30% 저렴",
        ],
      },
      {
        slide_type: "team",
        title: "수의학 박사 + 해외영업 전문가",
        headline: "반려동물 헬스케어 15년 + 해외 수출 10년 경험",
        bullets: [
          "CEO: 수의학 박사, 동물 헬스케어 15년",
          "COO: 일본·동남아 소비재 수출 10년",
          "CTO: 바이오 화학 석사, 특허 2건 보유",
          "자체 GMP 공장 보유 (월 10만개 생산)",
        ],
      },
      {
        slide_type: "financials",
        title: "3년 내 해외매출 비중 40% 목표",
        headline: "1차년도 6억 → 2차년도 15억 → 3차년도 35억 (해외 매출)",
        bullets: [
          "1차년도: 일본·태국 매출 6억원 (전체 15%)",
          "2차년도: +베트남, 해외 매출 15억원 (30%)",
          "3차년도: +미국, 해외 매출 35억원 (40%)",
        ],
      },
      {
        slide_type: "roadmap",
        title: "글로벌 진출 18개월 로드맵",
        headline: "일본 → 동남아 → 미국, 단계적 시장 확대",
        bullets: [
          "Phase 1 (1~6M): 일본 인증 + 아마존재팬 입점",
          "Phase 2 (7~12M): Shopee/Lazada + 동물병원 20곳",
          "Phase 3 (13~18M): Amazon US + SuperZoo 참가",
        ],
      },
      {
        slide_type: "ask",
        title: "시리즈 A 30억원 투자 제안",
        headline: "해외 진출 가속화를 위한 30억원 투자 유치",
        bullets: [
          "투자금 활용: 해외 인증 40% / 마케팅 35% / 전시회 25%",
          "기대 수익: 3년 내 해외 매출 누적 56억원",
          "Exit 전략: 글로벌 펫케어 기업 M&A 또는 IPO",
        ],
      },
    ],
  },
  {
    title: "ESG 리포트 자동화 플랫폼 투자유치 IR",
    planTitle: "AI 기반 ESG 리포트 자동화 플랫폼 사업계획서",
    template: "tech",
    templateLabel: "테크",
    slideCount: 10,
    score: "A",
    color: "blue",
    slides: [
      {
        slide_type: "cover",
        title: "ESG 리포트 자동화 — AI SaaS",
        headline: "ESG 보고서 작성 비용 90% 절감, 기간 80% 단축",
        bullets: ["예비창업패키지 IR 자료", "시리즈 Seed 투자유치"],
      },
      {
        slide_type: "problem",
        title: "중소기업 ESG 대응 불가능",
        headline: "ESG 보고서 1건 = 3,000만원 + 6개월. 중소기업은 전담인력 0명",
        bullets: [
          "2025년 ESG 의무공시 확대 → 대응 시급",
          "대기업 공급망 ESG 평가 통과 필수",
          "중소기업 ESG 전담인력 평균 0명",
        ],
      },
      {
        slide_type: "solution",
        title: "AI가 ESG 보고서를 자동 작성",
        headline: "ERP 연동 데이터 수집 → GPT-4 기반 보고서 생성 → 리스크 대시보드",
        bullets: [
          "GRI/SASB/TCFD 프레임워크 자동 준수",
          "한국어 ESG 보고서 1,200건 학습",
          "월 50만원으로 3,000만원 컨설팅 대체",
        ],
      },
      {
        slide_type: "market",
        title: "ESG SaaS 시장 2,000억원",
        headline: "TAM 8,000억 → SAM 2,000억 → SOM 30억",
        bullets: [
          "ESG 컨설팅 시장: 8,000억원 (연 30%+)",
          "중소·중견 ESG SaaS: 2,000억원 (연 45%)",
          "1차년도 대기업 협력사 500곳 타깃",
        ],
      },
      {
        slide_type: "business_model",
        title: "월 구독 SaaS + 인증 대행",
        headline: "Basic 50만/Pro 100만/Enterprise 맞춤 + 인증 대행 건당 200만",
        bullets: [
          "고객 유지율 목표 85%",
          "LTV/CAC 비율 5:1",
          "ESG 데이터 분석 API 추가 수익원",
        ],
      },
      {
        slide_type: "tech",
        title: "서울대 AI 연구소 공동 개발",
        headline: "ESG 특화 LLM + 데이터 자동 수집 엔진 + 리스크 경보 시스템",
        bullets: [
          "ESG 특화 언어모델 (한국어 최적화)",
          "ERP·회계 시스템 API 자동 연동",
          "실시간 규제 변경 알림",
        ],
      },
      {
        slide_type: "traction",
        title: "베타 테스트 30곳 확보 예정",
        headline: "MVP 개발 완료, 제조업 특화 버전 베타 런칭 준비 중",
        bullets: [
          "MVP 프로토타입 완성",
          "LOI 10곳 확보 (대기업 1차 협력사)",
          "서울대 AI 연구소 공동연구 MOU",
        ],
      },
      {
        slide_type: "team",
        title: "ESG 컨설팅 + AI + 정책 전문가",
        headline: "삼성SDS ESG팀 + 네이버 AI Lab + 대한상의 ESG 평가위원",
        bullets: [
          "CEO: 前 삼성SDS ESG팀 리드, 보고서 50건+",
          "CTO: 서울대 AI 석사, NLP 논문 12편",
          "COO: 대한상의 ESG 평가위원 7년",
        ],
      },
      {
        slide_type: "financials",
        title: "1차년도 매출 30억 목표",
        headline: "월 매출 5,000만 → 유료 고객 100곳 → 2차년도 시리즈A",
        bullets: [
          "6개월: MVP + 베타 30곳",
          "12개월: 유료 100곳, 월 매출 5,000만",
          "18개월: SASB/TCFD + 해외 진출",
        ],
      },
      {
        slide_type: "ask",
        title: "예비창업패키지 1억원 + Seed 5억원",
        headline: "AI 모델 40% + 플랫폼 30% + 마케팅 20% + 운영 10%",
        bullets: [
          "AI 모델 개발: 4,000만원",
          "플랫폼 개발: 3,000만원",
          "마케팅·고객 확보: 2,000만원",
        ],
      },
    ],
  },
  {
    title: "친환경 패키징 소재 투자유치 IR",
    planTitle: "친환경 패키징 소재 기술사업화 사업계획서",
    template: "professional",
    templateLabel: "프로페셔널",
    slideCount: 10,
    score: "A+",
    color: "green",
    slides: [
      {
        slide_type: "cover",
        title: "해조류 기반 생분해 패키징 소재",
        headline: "플라스틱을 대체하는 차세대 친환경 소재 기업",
        bullets: ["기술사업화 IR 자료", "시리즈A 투자유치"],
      },
      {
        slide_type: "problem",
        title: "플라스틱 포장재 규제 강화",
        headline: "2025년 플라스틱 규제 본격 시행, 대체 소재 수요 폭발",
        bullets: [
          "연간 플라스틱 포장재 1.4억톤 사용",
          "EU/한국 플라스틱 사용 규제 강화",
          "기존 생분해 소재: 강도 약하고 원가 높음",
        ],
      },
      {
        slide_type: "solution",
        title: "해조류 나노셀룰로오스 필름",
        headline: "기존 생분해 소재 대비 강도 2배, 원가 30% 절감",
        bullets: [
          "해조류 추출 나노셀룰로오스 기술",
          "기존 설비 호환 (드롭인 대체 가능)",
          "특허 3건 (국내 2 + PCT 1) 확보",
        ],
      },
      {
        slide_type: "market",
        title: "친환경 패키징 450조원 시장",
        headline: "TAM 450조 → SAM 35조 → SOM 5,000억",
        bullets: [
          "글로벌 친환경 패키징: 450조원 (연 14.5%)",
          "식품용 생분해 필름: 35조원 (연 20%)",
          "국내 식품·화장품 포장재: 5,000억원",
        ],
      },
      {
        slide_type: "competition",
        title: "경쟁사 대비 핵심 우위",
        headline: "해양 원료 + 기존 설비 호환 + 원가 경쟁력",
        bullets: [
          "vs Notpla(영국): 필름 기술 미보유",
          "vs TIPA(이스라엘): 원가 30% 절감",
          "vs SKC: 석유화학 원료 의존하지 않음",
        ],
      },
      {
        slide_type: "tech",
        title: "KAIST 공동연구, TRL 7",
        headline: "파일럿 생산 검증 완료, 월 5톤 시제품 생산",
        bullets: [
          "KAIST 소재공학과 3년 공동연구",
          "TRL 7 — 파일럿 생산 검증 완료",
          "특허 3건 등록, 기술이전 협의 중",
        ],
      },
      {
        slide_type: "business_model",
        title: "B2B 소재 판매 + 기술 라이선싱",
        headline: "kg당 12,000원 소재 판매 + 해외 기업 로열티 3%",
        bullets: [
          "초기 고객: CJ, 풀무원, 아모레퍼시픽",
          "해외 제조사 기술 라이선싱",
          "ESG 프리미엄 가격 정책",
        ],
      },
      {
        slide_type: "team",
        title: "소재공학 박사 + 생산 전문가",
        headline: "KAIST 연구진 출신 + 대기업 생산관리 경력",
        bullets: [
          "CEO: 소재공학 박사, 논문 20편",
          "CTO: 前 삼성SDI 소재 개발팀",
          "생산팀장: 화학 공장 15년 운영 경험",
        ],
      },
      {
        slide_type: "financials",
        title: "3년 내 매출 150억, 고용 30명",
        headline: "양산 설비 구축 → 국내 납품 → 해외 확장",
        bullets: [
          "6개월: 양산 설비 (월 50톤)",
          "12개월: 국내 5곳 납품, 월 2억원",
          "18개월: EU/일본 인증 + 수출",
        ],
      },
      {
        slide_type: "ask",
        title: "기술사업화 5억 + 시리즈A 20억",
        headline: "양산 설비 50% + 인증 20% + 인력 15% + 마케팅 15%",
        bullets: [
          "양산 설비 투자: 2.5억원",
          "해외 인증 (KC, EU REACH, FDA): 1억원",
          "인력 채용 + 마케팅: 1.5억원",
        ],
      },
    ],
  },
];

export function IRExampleCards() {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  // 펼친 상태: 실제 /plans/[id]/ir 페이지와 동일한 슬라이드 목록
  if (expandedIdx !== null) {
    const ir = EXAMPLE_IRS[expandedIdx];
    return (
      <div className="space-y-6">
        {/* 헤더 — 실제 IR 편집기와 동일 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setExpandedIdx(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900">IR PPT 편집기</h1>
                <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">
                  예시
                </Badge>
              </div>
              <p className="text-sm text-gray-500">{ir.planTitle}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Download className="h-4 w-4" /> PPTX 다운로드
            </Button>
          </div>
        </div>

        {/* 슬라이드 목록 — 실제 IR 편집기와 동일한 카드 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              슬라이드 ({ir.slides.length}장)
            </h2>
            <Badge variant="outline" className="text-xs">
              {ir.templateLabel} 템플릿
            </Badge>
          </div>

          <div className="grid gap-3">
            {ir.slides.map((slide, i) => (
              <Card key={i} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-xs">
                          {SLIDE_TYPE_LABELS[slide.slide_type] || slide.slide_type}
                        </Badge>
                        <h3 className="font-medium text-gray-900 truncate">
                          {slide.title}
                        </h3>
                      </div>
                      {slide.headline && (
                        <p className="text-sm text-gray-600 mb-1">{slide.headline}</p>
                      )}
                      {slide.bullets.length > 0 && (
                        <ul className="text-xs text-gray-500 space-y-0.5">
                          {slide.bullets.map((b, bi) => (
                            <li key={bi} className="truncate">• {b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 하단 CTA */}
        <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50">
          <CardContent className="flex flex-col items-center py-6">
            <Sparkles className="h-8 w-8 text-purple-600 mb-2" />
            <h3 className="font-bold text-purple-900">
              이 예시처럼 IR PPT를 자동 생성합니다
            </h3>
            <p className="text-xs text-purple-700 mt-1">
              사업계획서를 먼저 완성하면 10~15장의 투자유치 PPT가 자동 생성됩니다
            </p>
            <Link href="/programs" className="mt-4">
              <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                <FileText className="h-4 w-4" /> 사업계획서 먼저 만들기
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 접힌 상태: 카드 3개
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-gray-900">
          이런 IR PPT가 만들어집니다
        </h2>
        <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs">
          AI 자동 생성 예시
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {EXAMPLE_IRS.map((ir, idx) => (
          <Card
            key={idx}
            className="hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-purple-50/40 relative overflow-hidden"
            onClick={() => setExpandedIdx(idx)}
          >
            <div className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg">
              예시
            </div>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 flex-shrink-0 mt-0.5">
                  <Presentation className="h-5 w-5 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <Badge
                      className={
                        ir.color === "green"
                          ? "bg-green-100 text-green-700 hover:bg-green-100"
                          : ir.color === "blue"
                          ? "bg-blue-100 text-blue-700 hover:bg-blue-100"
                          : "bg-purple-100 text-purple-700 hover:bg-purple-100"
                      }
                    >
                      {ir.score}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {ir.slideCount}장
                    </Badge>
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {ir.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ir.templateLabel} 템플릿
                  </p>
                </div>
              </div>

              {/* 미리보기 — 슬라이드 3개 */}
              <div className="mt-3 space-y-1">
                {ir.slides.slice(0, 3).map((slide, si) => (
                  <div
                    key={si}
                    className="flex items-center gap-2 bg-white/70 rounded px-2 py-1 border border-indigo-100"
                  >
                    <span className="text-[10px] text-gray-400 font-mono w-3 text-right flex-shrink-0">
                      {si + 1}
                    </span>
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 flex-shrink-0">
                      {SLIDE_TYPE_LABELS[slide.slide_type]}
                    </Badge>
                    <span className="text-[10px] text-gray-600 truncate">
                      {slide.title}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-indigo-500 text-center pt-1">
                  클릭하여 전체 슬라이드 보기 ({ir.slides.length}장)
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
