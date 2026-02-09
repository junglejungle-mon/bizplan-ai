import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  FileText,
  Presentation,
  MessageSquare,
  FolderOpen,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Bot,
  TrendingUp,
  Target,
  Lightbulb,
  Send,
  BarChart3,
  PieChart,
  Download,
  Eye,
  Layers,
  Monitor,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4">AI 기반 정부지원사업 서비스</Badge>
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              정부지원사업을 찾고
              <br />
              <span className="text-blue-600">사업계획서까지 자동으로</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              AI가 우리 회사에 맞는 정부지원사업을 추천하고,
              공고 양식에 맞춰 사업계획서를 자동으로 작성합니다.
              더 이상 전문가에게 수백만원을 쓰지 마세요.
            </p>
            <div className="mt-8 flex items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="gap-2">
                  무료로 시작하기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button variant="outline" size="lg">
                  기능 살펴보기
                </Button>
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-500">
              서류 연동 시 사업계획서 1건 무료 제공
            </p>
          </div>
        </div>
      </section>

      {/* Problem vs Solution */}
      <section className="py-16 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            <div className="rounded-2xl bg-red-50 p-8">
              <h3 className="text-lg font-semibold text-red-800">기존의 문제</h3>
              <ul className="mt-4 space-y-3">
                {[
                  "정부지원사업이 너무 많아 어디에 지원해야 할지 모름",
                  "사업계획서 작성에 전문가 비용 수십~수백만원",
                  "매번 공고 양식이 달라 처음부터 작성해야 함",
                  "마감일 놓치면 1년을 기다려야 함",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-red-700">
                    <span className="mt-0.5 text-red-400">✕</span>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl bg-blue-50 p-8">
              <h3 className="text-lg font-semibold text-blue-800">BizPlan AI의 해결</h3>
              <ul className="mt-4 space-y-3">
                {[
                  "AI가 우리 회사에 맞는 사업을 자동 매칭 (0~100점)",
                  "공고 양식 인식 → 섹션별 AI 자동 작성 (수분 내 완성)",
                  "평가 기준 분석으로 배점 높은 항목에 전략적 집중",
                  "마감일 알림 + 캘린더 자동 등록",
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-blue-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-blue-500 flex-shrink-0" />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">핵심 기능 6가지</h2>
            <p className="mt-3 text-gray-600">정부지원사업 매칭부터 사업계획서, IR PPT까지 원스톱</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Zap, title: "AI 질문형 사업방향 고도화", description: "AI가 대화로 사업 방향을 파악하고, 정부지원사업에 최적화된 프로필을 구축합니다.", badge: "차별화" },
              { icon: Search, title: "정부지원사업 AI 매칭", description: "기업마당, 중소벤처24, K-Startup 3개 API에서 자동 수집 + AI 적합성 분석", badge: null },
              { icon: FileText, title: "사업계획서 원스톱 자동작성", description: "공고 양식 OCR → 섹션 추출 → 평가 기준 분석 → AI 자동 작성. 수분 내 초안 완성!", badge: "핵심" },
              { icon: Presentation, title: "IR PPT 자동 생성", description: "완성된 사업계획서를 기반으로 투자유치용 IR PPT를 자동 생성합니다.", badge: "차별화" },
              { icon: MessageSquare, title: "AI 사업 비서", description: "모든 페이지에서 AI 비서가 지원사업 상담, 사업계획서 코칭, 전략 자문을 제공합니다.", badge: "차별화" },
              { icon: FolderOpen, title: "서류관리 + 데이터 연동", description: "홈택스, 중소벤처24 서류 데이터를 사업계획서에 자동 반영. 연동할수록 품질 향상!", badge: "인센티브" },
            ].map((feature, i) => (
              <div key={i} className="relative rounded-2xl border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow">
                {feature.badge && (
                  <Badge variant={feature.badge === "핵심" ? "default" : "secondary"} className="absolute top-4 right-4">{feature.badge}</Badge>
                )}
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                  <feature.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-gray-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI 비서 컨설팅 섹션 */}
      <section className="py-20 bg-gradient-to-br from-indigo-50 via-white to-blue-50 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 items-center">
            {/* 좌측: 텍스트 */}
            <div>
              <Badge className="mb-4 bg-indigo-100 text-indigo-700 hover:bg-indigo-100">AI 창업 컨설팅</Badge>
              <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
                AI 비서에게 물어보세요
                <br />
                <span className="text-indigo-600">사업계획서 선정률을 높이는 방법</span>
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                전문 컨설턴트에게 수백만원을 쓰지 않아도 됩니다.
                AI 비서가 실시간으로 사업 전략을 분석하고,
                정부지원사업 선정 확률을 높이는 맞춤형 조언을 제공합니다.
              </p>
              <div className="mt-8 space-y-4">
                {[
                  { icon: Target, text: "우리 회사에 딱 맞는 지원사업 추천", sub: "AI가 사업 방향을 분석해 최적의 공고를 매칭" },
                  { icon: TrendingUp, text: "선정 확률을 높이는 사업계획서 코칭", sub: "평가 기준 분석 → 배점 높은 항목 전략적 강화" },
                  { icon: Lightbulb, text: "24시간 사업 전략 자문", sub: "지원 시기, 중복 지원, 서류 준비까지 실시간 상담" },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 flex-shrink-0">
                      <item.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{item.text}</p>
                      <p className="text-sm text-gray-500">{item.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/signup" className="inline-block mt-8">
                <Button size="lg" className="gap-2 bg-indigo-600 hover:bg-indigo-700">
                  AI 비서 무료 체험 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* 우측: AI 채팅 미리보기 */}
            <div className="relative">
              <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden max-w-md mx-auto">
                {/* 채팅 헤더 */}
                <div className="bg-indigo-600 px-5 py-3.5 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                    <Bot className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">AI 사업 비서</p>
                    <p className="text-xs text-indigo-200">온라인</p>
                  </div>
                </div>

                {/* 채팅 메시지들 */}
                <div className="px-5 py-6 space-y-4 bg-gray-50 min-h-[320px]">
                  {/* AI 인사 */}
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 shadow-sm max-w-[280px]">
                      <p className="text-sm text-gray-700">
                        안녕하세요! AI 사업 비서입니다. 어떤 도움이 필요하신가요?
                      </p>
                    </div>
                  </div>

                  {/* 유저 질문 */}
                  <div className="flex justify-end">
                    <div className="rounded-2xl rounded-tr-sm bg-indigo-600 px-4 py-2.5 max-w-[260px]">
                      <p className="text-sm text-white">
                        사업계획서 선정률을 높이려면 어떻게 해야 하나요?
                      </p>
                    </div>
                  </div>

                  {/* AI 답변 */}
                  <div className="flex gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 flex-shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="rounded-2xl rounded-tl-sm bg-white px-4 py-2.5 shadow-sm max-w-[280px]">
                      <p className="text-sm text-gray-700">
                        3가지 핵심 전략을 추천드립니다:
                      </p>
                      <div className="mt-2 space-y-1.5">
                        <p className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold">1.</span>
                          <span>평가 배점이 높은 <strong>기술 차별성</strong> 섹션에 R&D 성과를 구체적으로 기술</span>
                        </p>
                        <p className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold">2.</span>
                          <span>시장 규모를 <strong>공신력 있는 통계</strong>로 뒷받침</span>
                        </p>
                        <p className="text-xs text-gray-600 flex items-start gap-1.5">
                          <span className="text-indigo-500 font-bold">3.</span>
                          <span>기존 매출 데이터로 <strong>사업 실현 가능성</strong>을 입증</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 빠른 액션 칩 */}
                  <div className="flex flex-wrap gap-2 pl-9">
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-600 cursor-pointer hover:bg-indigo-50">
                      맞춤 사업 추천
                    </span>
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-600 cursor-pointer hover:bg-indigo-50">
                      사업계획서 작성
                    </span>
                    <span className="inline-flex items-center rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs text-indigo-600 cursor-pointer hover:bg-indigo-50">
                      전략 상담
                    </span>
                  </div>
                </div>

                {/* 입력창 */}
                <div className="border-t border-gray-200 bg-white px-4 py-3 flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="AI 비서에게 질문하세요..."
                    className="flex-1 text-sm text-gray-500 bg-gray-50 rounded-full px-4 py-2 border border-gray-200 outline-none"
                    readOnly
                  />
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-white">
                    <Send className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>

              {/* 성공률 뱃지 (플로팅) */}
              <div className="absolute -top-4 -right-4 sm:right-0 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-600">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">사업계획서 선정률</p>
                  <p className="text-lg font-bold text-green-600">평균 2.4배 향상</p>
                </div>
              </div>

              {/* 유저 수 뱃지 (플로팅) */}
              <div className="absolute -bottom-4 -left-4 sm:left-0 bg-white rounded-xl shadow-lg border border-gray-100 px-4 py-3 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">AI 상담 건수</p>
                  <p className="text-lg font-bold text-blue-600">24시간 무제한</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 결과물 쇼케이스 (포트폴리오) */}
      <section id="portfolio" className="py-20 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-blue-100 text-blue-700 hover:bg-blue-100">AI가 만든 결과물</Badge>
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              이런 결과물이 <span className="text-blue-600">자동으로</span> 완성됩니다
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-600">
              공고 분석부터 사업계획서, IR PPT까지. AI가 수분 내에 전문가 수준의 결과물을 만들어 드립니다.
            </p>
          </div>

          {/* 사업계획서 + IR PPT 카드 */}
          <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-2">

            {/* 사업계획서 미리보기 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-xl transition-all overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <Badge className="bg-blue-600 text-white">사업계획서</Badge>
              </div>

              {/* 문서 미리보기 영역 */}
              <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-6 pb-0">
                <div className="rounded-t-lg border border-b-0 border-gray-200 bg-white shadow-sm overflow-hidden mx-auto max-w-sm">
                  {/* 문서 헤더 */}
                  <div className="border-b border-gray-100 px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-gray-700">2026 스마트제조 혁신지원사업</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="h-2 w-2 rounded-full bg-green-400" />
                      <span className="text-xs text-green-600">완성</span>
                    </div>
                  </div>

                  {/* 목차 미리보기 */}
                  <div className="px-5 py-4 space-y-2.5">
                    {[
                      { section: "1. 사업 개요", progress: 100 },
                      { section: "2. 기술 개발 내용", progress: 100 },
                      { section: "3. 시장 분석 및 경쟁력", progress: 100 },
                      { section: "4. 사업화 전략", progress: 100 },
                      { section: "5. 추진 일정 및 소요예산", progress: 100 },
                      { section: "6. 기대효과 및 활용방안", progress: 100 },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                        <span className="text-xs text-gray-700 flex-1">{item.section}</span>
                        <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${item.progress}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 콘텐츠 미리보기 (블러) */}
                  <div className="px-5 pb-4 relative">
                    <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-400 leading-relaxed space-y-1.5" style={{ filter: "blur(1.5px)" }}>
                      <p className="font-medium text-gray-500">1. 사업 개요</p>
                      <p>본 사업은 AI 기반 스마트 제조 공정 최적화 시스템을 개발하여 중소 제조기업의 생산성을 향상시키고자 합니다. 기존 수동 품질검사 공정을 딥러닝 비전 시스템으로 대체하여...</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 하단 설명 */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">사업계획서 자동 작성</h3>
                <p className="mt-1.5 text-sm text-gray-500">
                  공고 양식을 OCR로 분석하고, 평가 기준에 맞춰 섹션별로 AI가 작성합니다.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" /> 6~12개 섹션</span>
                  <span className="flex items-center gap-1"><BarChart3 className="h-3.5 w-3.5" /> 평가기준 분석</span>
                  <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" /> HWP/PDF/DOCX</span>
                </div>
              </div>
            </div>

            {/* IR PPT 미리보기 */}
            <div className="group relative rounded-2xl border border-gray-200 bg-white shadow-sm hover:shadow-xl transition-all overflow-hidden">
              <div className="absolute top-4 right-4 z-10">
                <Badge className="bg-indigo-600 text-white">IR PPT</Badge>
              </div>

              {/* 슬라이드 미리보기 영역 */}
              <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-6 pb-0">
                <div className="grid grid-cols-3 gap-2 mx-auto max-w-sm">
                  {/* 슬라이드 1: 표지 */}
                  <div className="rounded-lg border border-gray-200 bg-gradient-to-br from-blue-600 to-indigo-700 p-3 aspect-[16/10] flex flex-col justify-between shadow-sm">
                    <div />
                    <div>
                      <div className="h-1 w-10 bg-white/40 rounded mb-1" />
                      <div className="h-1.5 w-16 bg-white/80 rounded mb-1" />
                      <div className="h-1 w-8 bg-white/30 rounded" />
                    </div>
                  </div>

                  {/* 슬라이드 2: 문제 정의 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-3 aspect-[16/10] flex flex-col shadow-sm">
                    <div className="h-1.5 w-10 bg-gray-800 rounded mb-2" />
                    <div className="flex-1 flex gap-1">
                      <div className="flex-1 rounded bg-red-50 p-1.5">
                        <div className="h-1 w-5 bg-red-300 rounded mb-1" />
                        <div className="h-0.5 w-full bg-red-100 rounded mb-0.5" />
                        <div className="h-0.5 w-3/4 bg-red-100 rounded" />
                      </div>
                      <div className="flex-1 rounded bg-red-50 p-1.5">
                        <div className="h-1 w-5 bg-red-300 rounded mb-1" />
                        <div className="h-0.5 w-full bg-red-100 rounded mb-0.5" />
                        <div className="h-0.5 w-2/3 bg-red-100 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* 슬라이드 3: 시장 규모 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-3 aspect-[16/10] flex flex-col shadow-sm">
                    <div className="h-1.5 w-12 bg-gray-800 rounded mb-2" />
                    <div className="flex-1 flex items-end gap-1 px-1">
                      <div className="w-3 bg-blue-200 rounded-t" style={{ height: "30%" }} />
                      <div className="w-3 bg-blue-300 rounded-t" style={{ height: "50%" }} />
                      <div className="w-3 bg-blue-400 rounded-t" style={{ height: "65%" }} />
                      <div className="w-3 bg-blue-500 rounded-t" style={{ height: "85%" }} />
                      <div className="w-3 bg-blue-600 rounded-t" style={{ height: "100%" }} />
                    </div>
                  </div>

                  {/* 슬라이드 4: 솔루션 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-3 aspect-[16/10] flex flex-col shadow-sm">
                    <div className="h-1.5 w-8 bg-gray-800 rounded mb-2" />
                    <div className="flex-1 grid grid-cols-2 gap-1">
                      <div className="rounded bg-blue-50 p-1">
                        <div className="h-2 w-2 rounded bg-blue-400 mx-auto mb-0.5" />
                        <div className="h-0.5 w-full bg-blue-200 rounded" />
                      </div>
                      <div className="rounded bg-green-50 p-1">
                        <div className="h-2 w-2 rounded bg-green-400 mx-auto mb-0.5" />
                        <div className="h-0.5 w-full bg-green-200 rounded" />
                      </div>
                      <div className="rounded bg-purple-50 p-1">
                        <div className="h-2 w-2 rounded bg-purple-400 mx-auto mb-0.5" />
                        <div className="h-0.5 w-full bg-purple-200 rounded" />
                      </div>
                      <div className="rounded bg-orange-50 p-1">
                        <div className="h-2 w-2 rounded bg-orange-400 mx-auto mb-0.5" />
                        <div className="h-0.5 w-full bg-orange-200 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* 슬라이드 5: 비즈니스 모델 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-3 aspect-[16/10] flex flex-col items-center justify-center shadow-sm">
                    <div className="h-1.5 w-10 bg-gray-800 rounded mb-2" />
                    <div className="h-8 w-8 rounded-full border-4 border-indigo-200 border-t-indigo-500" />
                  </div>

                  {/* 슬라이드 6: 팀 */}
                  <div className="rounded-lg border border-gray-200 bg-white p-3 aspect-[16/10] flex flex-col shadow-sm">
                    <div className="h-1.5 w-6 bg-gray-800 rounded mb-2" />
                    <div className="flex-1 flex items-center justify-center gap-2">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-gray-300" />
                        <div className="h-0.5 w-4 bg-gray-200 rounded mt-0.5" />
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-gray-300" />
                        <div className="h-0.5 w-4 bg-gray-200 rounded mt-0.5" />
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-gray-300" />
                        <div className="h-0.5 w-4 bg-gray-200 rounded mt-0.5" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 슬라이드 카운터 */}
                <div className="text-center py-3">
                  <span className="text-xs text-gray-400">10~15장 자동 생성</span>
                </div>
              </div>

              {/* 하단 설명 */}
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900">IR PPT 자동 생성</h3>
                <p className="mt-1.5 text-sm text-gray-500">
                  사업계획서 내용을 기반으로 투자유치용 IR 덱을 자동으로 만들어 드립니다.
                </p>
                <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><Monitor className="h-3.5 w-3.5" /> 3종 템플릿</span>
                  <span className="flex items-center gap-1"><PieChart className="h-3.5 w-3.5" /> 차트 자동 생성</span>
                  <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" /> PPTX/PDF</span>
                </div>
              </div>
            </div>
          </div>

          {/* 프로세스 플로우 */}
          <div className="mt-16">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
              {[
                { step: "1", title: "AI 인터뷰", desc: "사업 방향 파악", color: "bg-blue-100 text-blue-700" },
                { step: "2", title: "지원사업 매칭", desc: "최적 공고 추천", color: "bg-indigo-100 text-indigo-700" },
                { step: "3", title: "사업계획서", desc: "AI 자동 작성", color: "bg-purple-100 text-purple-700" },
                { step: "4", title: "IR PPT", desc: "투자유치 덱 생성", color: "bg-violet-100 text-violet-700" },
              ].map((item, i) => (
                <div key={i} className="flex items-center">
                  <div className="flex flex-col items-center text-center">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${item.color} font-bold text-lg`}>
                      {item.step}
                    </div>
                    <p className="mt-2 text-sm font-medium text-gray-900">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.desc}</p>
                  </div>
                  {i < 3 && (
                    <ArrowRight className="hidden sm:block h-5 w-5 text-gray-300 mx-6" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link href="/signup">
              <Button size="lg" className="gap-2">
                결과물 직접 만들어보기 <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <p className="mt-3 text-xs text-gray-400">무료 체험으로 사업계획서 퀄리티를 직접 확인하세요</p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900">요금제</h2>
            <p className="mt-3 text-gray-600">경쟁사 대비 30~40% 저렴 + 사업계획서 기능 포함</p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto">
            {[
              { name: "무료", price: "0", description: "서비스 체험", features: ["AI 인터뷰 + 프로필 구축", "지원사업 매칭 3건/월", "AI 비서 5회/일", "서류 전체 연동 시 계획서 1건 무료"], cta: "무료로 시작", popular: false },
              { name: "스타터", price: "49,000", description: "본격 활용", features: ["매칭 무제한", "사업계획서 3건/월", "AI 비서 무제한", "섹션 재생성"], cta: "스타터 시작", popular: false },
              { name: "프로", price: "99,000", description: "무제한 활용", features: ["전체 무제한", "사업계획서 무제한", "IR PPT 생성", "HWP/PDF/DOCX 내보내기", "우선 지원"], cta: "프로 시작", popular: true },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl border p-8 ${plan.popular ? "border-blue-600 shadow-lg ring-1 ring-blue-600" : "border-gray-200"}`}>
                {plan.popular && <Badge className="absolute -top-3 left-1/2 -translate-x-1/2"><Star className="mr-1 h-3 w-3" /> 추천</Badge>}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="text-sm text-gray-500">{plan.description}</p>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">원/월</span>
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-blue-500 flex-shrink-0" />{feature}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="mt-8 block">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>{plan.cta}</Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-blue-600">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">지금 바로 AI로 사업계획서를 작성하세요</h2>
          <p className="mt-4 text-blue-100">서류 연동 시 사업계획서 1건 무료. 신용카드 불필요.</p>
          <Link href="/signup">
            <Button size="lg" className="mt-8 bg-white text-blue-600 hover:bg-gray-100 gap-2">
              무료로 시작하기 <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
