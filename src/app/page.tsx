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

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-white">
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
